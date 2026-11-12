import { describe, expect, it, vi } from 'vitest'
import { findMode } from '../modes'
import type { VocabularyReviewRecord, VocabularyState } from '../ports'
import { createInitialState, schedule } from '../srs/scheduler'
import { DAY_MS } from '../srs/time'
import { VocabularySyncError } from './api'
import { createCloudVocabularyRepository, VocabularyAccountMismatchError, type CloudVocabularyOptions } from './cloud'
import { createVocabularyOutbox } from './outbox'
import { createFakeVocabularyServer, type FakeVocabularyServer } from './testing/fake-api'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const T0 = Date.UTC(2026, 10, 1, 9)

let seq = 0
/** Answers one word exactly like VocabularySession does: schedule locally, build the record. */
function answer(state: VocabularyState, modeId: string, correct: boolean, at: number): { state: VocabularyState; review: VocabularyReviewRecord } {
  const mode = findMode(modeId)!
  const next = schedule(state, { skill: mode.skill, correct, now: new Date(at) })
  seq += 1
  return {
    state: next.state,
    review: {
      id: `rev-cloud-${seq.toString().padStart(5, '0')}`,
      studentId: state.studentId,
      entryId: state.entryId,
      modeId,
      skill: mode.skill,
      correct: next.quality >= 3,
      quality: next.quality,
      hintUsed: false,
      reviewedAt: new Date(at).toISOString(),
      intervalDaysAfter: next.state.intervalDays,
      stageAfter: next.state.stage,
    },
  }
}

function device(server: FakeVocabularyServer, overrides: Partial<CloudVocabularyOptions> = {}) {
  const storage = new Storage()
  const retries: (() => void)[] = []
  const repo = createCloudVocabularyRepository({
    api: server.api(),
    getSessionUserId: async () => server.sessionUserId,
    outbox: createVocabularyOutbox(storage),
    scheduleRetry: (run) => {
      retries.push(run)
      return () => undefined
    },
    ...overrides,
  })
  return { repo, storage, retries }
}

// jsdom provides Storage but not its constructor; a tiny Map-backed one keeps devices separate.
class Storage implements globalThis.Storage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    return this.map.get(key) ?? null
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
}

async function save(repo: ReturnType<typeof device>['repo'], step: { state: VocabularyState; review: VocabularyReviewRecord }) {
  // Same order as useVocabularyMutations().saveReview.
  await repo.upsertState(step.state)
  await repo.recordReview(step.review)
}

describe('cloud vocabulary repository', () => {
  it('syncs a review and returns the server’s state, identical to the local schedule', async () => {
    const server = createFakeVocabularyServer(() => new Date(T0 + DAY_MS))
    server.sessionUserId = A
    const { repo } = device(server)
    const step = answer(createInitialState(A, 'v-hello', new Date(T0)), 'active_recall', true, T0)
    await save(repo, step)

    expect(server.reviews.get(step.review.id)?.student_id).toBe(A)
    expect(repo.pendingCount(A)).toBe(0)
    const states = await repo.listStates(A)
    expect(states).toHaveLength(1)
    const { updatedAt: _a, ...fromServer } = states[0]!
    const { updatedAt: _b, ...local } = step.state
    expect(fromServer).toEqual(local)
  })

  it('never sends client-computed quality, interval or stage', async () => {
    const server = createFakeVocabularyServer()
    server.sessionUserId = A
    const spy = vi.spyOn(server.api(), 'recordReviews')
    const { repo } = device(server)
    const step = answer(createInitialState(A, 'v-name', new Date(T0)), 'meaning_choice', true, T0)
    await save(repo, step)
    const sent = spy.mock.calls[0]![1][0]!
    expect(Object.keys(sent).sort()).toEqual(['correct', 'entry_id', 'hint_used', 'id', 'mode_id', 'reviewed_at', 'skill'])
  })

  it('submits each review once even when it is recorded and flushed repeatedly', async () => {
    const server = createFakeVocabularyServer()
    server.sessionUserId = A
    const { repo } = device(server)
    const step = answer(createInitialState(A, 'v-name', new Date(T0)), 'meaning_choice', true, T0)
    await save(repo, step)
    await repo.recordReview(step.review) // e.g. a double tap or a retried mutation
    await repo.flush()
    expect([...server.reviews.values()].filter((r) => r.id === step.review.id)).toHaveLength(1)
    expect(server.states.get(`${A}:v-name`)?.review_count).toBe(1)
  })

  it('queues reviews while offline, shows them optimistically, and syncs when back online', async () => {
    const server = createFakeVocabularyServer()
    server.sessionUserId = A
    const { repo, retries, storage } = device(server)
    server.online = false
    const first = answer(createInitialState(A, 'v-from', new Date(T0)), 'active_recall', true, T0)
    const second = answer(first.state, 'active_recall', true, T0 + DAY_MS)
    await expect(save(repo, first)).resolves.toBeUndefined()
    await save(repo, second)

    expect(repo.pendingCount(A)).toBe(2)
    expect(storage.getItem(`speaklab.vocab.outbox.v1:${A}`)).toContain(first.review.id)
    expect(retries.length).toBeGreaterThan(0)
    // Offline with no cached server copy: reads fail loudly rather than pretend.
    await expect(repo.listStates(A)).rejects.toBeInstanceOf(VocabularySyncError)

    server.online = true
    retries.shift()!()
    await vi.waitFor(() => expect(repo.pendingCount(A)).toBe(0))
    expect(server.states.get(`${A}:v-from`)).toMatchObject({ repetitions: 2, review_count: 2 })
  })

  it('survives a reload while offline (the queue is durable) and retries transient server errors', async () => {
    const server = createFakeVocabularyServer()
    server.sessionUserId = A
    const first = device(server)
    server.failNext = 1
    const step = answer(createInitialState(A, 'v-student', new Date(T0)), 'meaning_choice', true, T0)
    await save(first.repo, step)
    expect(first.repo.pendingCount(A)).toBe(1)

    // Same device, new page load: a fresh repository over the same storage.
    const reloaded = createCloudVocabularyRepository({
      api: server.api(),
      getSessionUserId: async () => server.sessionUserId,
      outbox: createVocabularyOutbox(first.storage),
      scheduleRetry: () => () => undefined,
    })
    const states = await reloaded.listStates(A)
    expect(states.map((s) => s.entryId)).toEqual(['v-student'])
    expect(reloaded.pendingCount(A)).toBe(0)
    expect(server.reviews.has(step.review.id)).toBe(true)
  })

  it('falls back to the last server copy plus queued reviews during a temporary outage', async () => {
    const server = createFakeVocabularyServer()
    server.sessionUserId = A
    const { repo } = device(server)
    const a = answer(createInitialState(A, 'v-hello', new Date(T0)), 'meaning_choice', true, T0)
    await save(repo, a)
    await repo.listStates(A)
    await repo.listReviews(A)
    server.online = false
    const b = answer(createInitialState(A, 'v-name', new Date(T0)), 'meaning_choice', false, T0 + 1000)
    await save(repo, b)
    expect((await repo.listStates(A)).map((s) => s.entryId).sort()).toEqual(['v-hello', 'v-name'])
    expect((await repo.listReviews(A)).map((r) => r.id)).toEqual([a.review.id, b.review.id])
  })

  it('restores progress on another device after signing in', async () => {
    const server = createFakeVocabularyServer()
    server.sessionUserId = A
    const phone = device(server)
    let s = createInitialState(A, 'v-teacher', new Date(T0))
    for (const [i, correct] of [true, true, false, true].entries()) {
      const step = answer(s, 'active_recall', correct, T0 + i * 3 * DAY_MS)
      await save(phone.repo, step)
      s = step.state
    }
    const laptop = device(server) // empty storage: nothing local at all
    const restored = await laptop.repo.listStates(A)
    expect(restored).toHaveLength(1)
    expect(restored[0]).toMatchObject({ entryId: 'v-teacher', lapses: s.lapses, intervalDays: s.intervalDays, dueAt: s.dueAt, recall: s.recall })
    expect((await laptop.repo.listReviews(A)).length).toBe(4)
  })

  it('does not let an older review from another device rewind newer progress', async () => {
    const server = createFakeVocabularyServer()
    server.sessionUserId = A
    const phone = device(server)
    const laptop = device(server)
    const start = createInitialState(A, 'v-hello', new Date(T0))
    server.online = false
    const stale = answer(start, 'meaning_choice', false, T0) // answered offline on the laptop
    await save(laptop.repo, stale)
    server.online = true
    const fresh = answer(start, 'meaning_choice', true, T0 + 60_000) // answered later on the phone
    await save(phone.repo, fresh)
    const report = await laptop.repo.flush()
    expect(report.statuses).toEqual({ recorded: 1 })
    expect(server.states.get(`${A}:v-hello`)).toMatchObject({ last_result_correct: true, review_count: 1 })
    expect(server.reviews.get(stale.review.id)?.applied).toBe(false)
  })

  it('reset clears the account and a stale queue from another device cannot bring progress back', async () => {
    const server = createFakeVocabularyServer(() => new Date(T0 + 10 * DAY_MS))
    server.sessionUserId = A
    const phone = device(server)
    const laptop = device(server)
    await save(phone.repo, answer(createInitialState(A, 'v-hello', new Date(T0)), 'meaning_choice', true, T0))
    server.online = false
    await save(laptop.repo, answer(createInitialState(A, 'v-name', new Date(T0)), 'meaning_choice', true, T0 + DAY_MS))
    server.online = true
    await phone.repo.clear(A)
    await laptop.repo.flush()
    expect(await phone.repo.listStates(A)).toEqual([])
    expect(await phone.repo.listReviews(A)).toEqual([])
  })
})

describe('cross-account safety', () => {
  it('refuses to read or write records for anyone but the signed-in account', async () => {
    const server = createFakeVocabularyServer()
    server.sessionUserId = A
    const { repo } = device(server)
    await expect(repo.listStates(B)).rejects.toBeInstanceOf(VocabularyAccountMismatchError)
    await expect(repo.listReviews(B)).rejects.toBeInstanceOf(VocabularyAccountMismatchError)
    await expect(repo.clear(B)).rejects.toBeInstanceOf(VocabularyAccountMismatchError)
    const forged = answer(createInitialState(B, 'v-hello', new Date(T0)), 'meaning_choice', true, T0)
    await expect(repo.recordReview(forged.review)).rejects.toBeInstanceOf(VocabularyAccountMismatchError)
    server.sessionUserId = null
    await expect(repo.listStates(A)).rejects.toBeInstanceOf(VocabularyAccountMismatchError)
  })

  it('never flushes A’s offline queue into B’s account after an account switch', async () => {
    const server = createFakeVocabularyServer()
    server.sessionUserId = A
    const { repo } = device(server)
    server.online = false
    const queued = answer(createInitialState(A, 'v-hello', new Date(T0)), 'meaning_choice', true, T0)
    await save(repo, queued)
    expect(repo.pendingCount(A)).toBe(1)

    server.sessionUserId = B // B signs in on the same device
    server.online = true
    await repo.flush()
    expect(server.calls.filter((c) => c.method === 'recordReviews' && c.expected === B)).toEqual([])
    expect(server.reviews.size).toBe(0)
    expect(await repo.listStates(B)).toEqual([])
  })

  it('keeps the queue when the session changes between reading it and sending it', async () => {
    const server = createFakeVocabularyServer()
    server.sessionUserId = A
    let reportedUser = A
    const { repo } = device(server, { getSessionUserId: async () => reportedUser })
    server.online = false
    await save(repo, answer(createInitialState(A, 'v-hello', new Date(T0)), 'meaning_choice', true, T0))
    server.online = true
    server.sessionUserId = B // the JWT already belongs to B; the app has not noticed yet
    const report = await repo.flush()
    expect(report.error?.kind).toBe('account')
    expect(server.reviews.size).toBe(0)
    expect(repo.pendingCount(A)).toBe(1)
    reportedUser = B
    expect(repo.pendingCount(B)).toBe(0)
  })

  it('dispose() forgets cached server data', async () => {
    const server = createFakeVocabularyServer()
    server.sessionUserId = A
    const { repo } = device(server)
    await save(repo, answer(createInitialState(A, 'v-hello', new Date(T0)), 'meaning_choice', true, T0))
    await repo.listStates(A)
    repo.dispose()
    server.online = false
    await expect(repo.listStates(A)).rejects.toBeInstanceOf(VocabularySyncError)
  })
})

describe('due vocabulary', () => {
  it('asks the server for words due by now and includes queued answers', async () => {
    const server = createFakeVocabularyServer()
    server.sessionUserId = A
    const { repo } = device(server)
    await save(repo, answer(createInitialState(A, 'v-hello', new Date(T0)), 'meaning_choice', true, T0)) // due T0+1d
    await save(repo, answer(createInitialState(A, 'v-name', new Date(T0)), 'meaning_choice', false, T0)) // due T0+1d
    const twoDaysOut = answer(createInitialState(A, 'v-from', new Date(T0)), 'active_recall', true, T0 + DAY_MS) // due T0+2d
    await save(repo, twoDaysOut)
    const due = await repo.listDueStates(A, new Date(T0 + DAY_MS + 1))
    expect(due.map((s) => s.entryId).sort()).toEqual(['v-hello', 'v-name'])
  })
})

describe('permanent rejections', () => {
  it('drops reviews the server rejects and reports them instead of retrying forever', async () => {
    const server = createFakeVocabularyServer()
    server.sessionUserId = A
    const onSyncProblem = vi.fn()
    const { repo, retries } = device(server, { onSyncProblem })
    const step = answer(createInitialState(A, 'v-hello', new Date(T0)), 'meaning_choice', true, T0)
    await save(repo, { ...step, review: { ...step.review, modeId: 'retired_mode' } })
    expect(repo.pendingCount(A)).toBe(0)
    expect(retries).toHaveLength(0)
    expect(onSyncProblem).toHaveBeenCalledWith(expect.objectContaining({ rejected: [{ id: step.review.id, reason: 'unknown_mode' }] }))
  })
})

describe('queue notifications (pending-sync indicator)', () => {
  it('notifies subscribers when answers are queued, sent, dropped and disposed', async () => {
    const server = createFakeVocabularyServer()
    server.sessionUserId = A
    const { repo } = device(server)
    const counts: number[] = []
    const unsubscribe = repo.subscribe(() => counts.push(repo.pendingCount(A)))

    server.online = false
    const step = answer(createInitialState(A, 'v-hello', new Date(T0)), 'active_recall', true, T0)
    await save(repo, step)
    expect(counts).toEqual([1])

    server.online = true
    await repo.flush()
    expect(counts).toEqual([1, 0])
    expect(repo.pendingCount(A)).toBe(0)

    server.online = false
    await save(repo, answer(step.state, 'active_recall', true, T0 + DAY_MS))
    expect(counts.at(-1)).toBe(1)
    repo.dispose()
    expect(counts.at(-1)).toBe(0)

    unsubscribe()
    server.online = true
    await save(repo, answer(step.state, 'active_recall', true, T0 + 2 * DAY_MS))
    expect(counts).toHaveLength(4)
  })
})
