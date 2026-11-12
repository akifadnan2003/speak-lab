import { describe, expect, it } from 'vitest'
import { createLocalVocabularyImporter, LocalImportRefusedError, planLocalVocabularyImport } from './cloud-import'
import type { VocabularySnapshot } from './migration'
import { findMode } from './modes'
import { createMemoryVocabularyRepository } from './persistence/memory'
import { createFakeVocabularyServer } from './persistence/testing/fake-api'
import type { VocabularyReviewRecord, VocabularyState } from './ports'
import { createInitialState, schedule } from './srs/scheduler'
import { DAY_MS } from './srs/time'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const T0 = Date.UTC(2026, 9, 1, 8)
let seq = 0

function practise(studentId: string, entryId: string, results: readonly boolean[], start = T0, modeId = 'meaning_choice') {
  const mode = findMode(modeId)!
  let state: VocabularyState = createInitialState(studentId, entryId, new Date(start))
  const reviews: VocabularyReviewRecord[] = []
  results.forEach((correct, i) => {
    const at = new Date(start + i * 2 * DAY_MS)
    const next = schedule(state, { skill: mode.skill, correct, now: at })
    seq += 1
    reviews.push({
      id: `rev-imp-${seq.toString().padStart(5, '0')}`,
      studentId,
      entryId,
      modeId,
      skill: mode.skill,
      correct: next.quality >= 3,
      quality: next.quality,
      hintUsed: false,
      reviewedAt: at.toISOString(),
      intervalDaysAfter: next.state.intervalDays,
      stageAfter: next.state.stage,
    })
    state = next.state
  })
  return { state, reviews }
}

function snapshot(studentId: string, parts: ReturnType<typeof practise>[]): VocabularySnapshot {
  return { version: 1, studentId, exportedAt: new Date(T0).toISOString(), states: parts.map((p) => p.state), reviews: parts.flatMap((p) => p.reviews) }
}

const emptyServer = { lastReviewedAt: new Map<string, string>(), reviewIds: new Set<string>(), resetAt: null }

describe('planLocalVocabularyImport (conflict rules)', () => {
  it('refuses another account’s records and preview records outright', () => {
    const local = snapshot(A, [practise(A, 'v-hello', [true])])
    expect(() => planLocalVocabularyImport(local, B, emptyServer)).toThrow(LocalImportRefusedError)
    const preview = snapshot('preview-student', [practise('preview-student', 'v-hello', [true])])
    expect(() => planLocalVocabularyImport(preview, 'preview-student', emptyServer)).toThrow(/Preview/)
    const mixed = { ...local, reviews: [...local.reviews, ...practise(B, 'v-name', [true]).reviews] }
    expect(() => planLocalVocabularyImport(mixed, A, emptyServer)).toThrow(/mixes accounts/)
  })

  it('imports words the account has never practised', () => {
    const plan = planLocalVocabularyImport(snapshot(A, [practise(A, 'v-hello', [true, true])]), A, emptyServer)
    expect(plan.upload).toHaveLength(2)
    expect(plan.entries).toEqual([{ entryId: 'v-hello', resolution: 'import' }])
  })

  it('never lets older local answers overwrite newer server progress', () => {
    const local = practise(A, 'v-hello', [false, false], T0)
    const plan = planLocalVocabularyImport(snapshot(A, [local]), A, {
      ...emptyServer,
      lastReviewedAt: new Map([['v-hello', new Date(T0 + 30 * DAY_MS).toISOString()]]),
    })
    expect(plan.upload).toEqual([])
    expect(plan.skipped.map((s) => s.reason)).toEqual(['older_than_server', 'older_than_server'])
    expect(plan.entries).toEqual([{ entryId: 'v-hello', resolution: 'server_newer' }])
  })

  it('adds only the local answers newer than the server’s latest for that word', () => {
    const local = practise(A, 'v-hello', [true, true, true], T0) // T0, T0+2d, T0+4d
    const plan = planLocalVocabularyImport(snapshot(A, [local]), A, {
      ...emptyServer,
      lastReviewedAt: new Map([['v-hello', new Date(T0 + 3 * DAY_MS).toISOString()]]),
    })
    expect(plan.upload.map((r) => r.reviewedAt)).toEqual([new Date(T0 + 4 * DAY_MS).toISOString()])
    expect(plan.entries).toEqual([{ entryId: 'v-hello', resolution: 'merge' }])
  })

  it('skips answers already uploaded and answers from before a reset', () => {
    const local = practise(A, 'v-hello', [true, true], T0)
    const plan = planLocalVocabularyImport(snapshot(A, [local]), A, {
      lastReviewedAt: new Map(),
      reviewIds: new Set([local.reviews[1]!.id]),
      resetAt: new Date(T0 + DAY_MS).toISOString(),
    })
    expect(plan.upload).toEqual([])
    expect(plan.skipped.map((s) => s.reason)).toEqual(['before_reset', 'already_on_server'])
  })

  it('reports words whose answer history was trimmed and therefore cannot be uploaded', () => {
    const local = practise(A, 'v-hello', [true])
    const plan = planLocalVocabularyImport({ ...snapshot(A, [local]), reviews: [] }, A, emptyServer)
    expect(plan.statesWithoutReviews).toEqual(['v-hello'])
    expect(plan.upload).toEqual([])
  })
})

describe('local-to-cloud importer', () => {
  function setup() {
    const server = createFakeVocabularyServer(() => new Date(T0 + 60 * DAY_MS))
    server.sessionUserId = A
    const device = createMemoryVocabularyRepository()
    const importer = createLocalVocabularyImporter({ device, api: server.api(), getSessionUserId: async () => server.sessionUserId })
    return { server, device, importer }
  }

  async function seedDevice(device: ReturnType<typeof createMemoryVocabularyRepository>, parts: ReturnType<typeof practise>[]) {
    for (const p of parts) {
      await device.upsertState(p.state)
      for (const r of p.reviews) await device.recordReview(r)
    }
  }

  it('finds nothing when the device has no records for this account', async () => {
    const { device, importer } = setup()
    await seedDevice(device, [practise(B, 'v-hello', [true])])
    expect(await importer.inspect(A)).toBeNull()
  })

  it('uploads only with explicit consent, matches the local schedule, then removes the device copy', async () => {
    const { server, device, importer } = setup()
    const hello = practise(A, 'v-hello', [true, true, false, true])
    await seedDevice(device, [hello])
    const plan = (await importer.inspect(A))!
    expect(server.reviews.size).toBe(0) // inspecting uploads nothing

    await expect(importer.run(plan, {} as { consent: true })).rejects.toThrow(/consent/)
    expect(server.reviews.size).toBe(0)

    const summary = await importer.run(plan, { consent: true })
    expect(summary).toMatchObject({ statuses: { applied: 4 }, clearedDevice: true })
    expect(server.states.get(`${A}:v-hello`)).toMatchObject({ interval_days: hello.state.intervalDays, lapses: hello.state.lapses, due_at: hello.state.dueAt })
    expect([...server.reviews.values()].every((r) => r.source === 'import' && r.student_id === A)).toBe(true)
    expect(await device.listReviews(A)).toEqual([])
  })

  it('is safe to run twice and after a partial failure (idempotent ids)', async () => {
    const { server, device, importer } = setup()
    await seedDevice(device, [practise(A, 'v-hello', [true, true]), practise(A, 'v-name', [true])])
    const plan = (await importer.inspect(A))!
    server.online = false
    await expect(importer.run(plan, { consent: true })).rejects.toThrow()
    expect((await device.listReviews(A)).length).toBe(3) // nothing deleted on failure
    server.online = true
    const first = await importer.run(plan, { consent: true })
    expect(first.statuses.applied).toBe(3)
    const again = await importer.run(plan, { consent: true })
    expect(again.statuses).toEqual({ duplicate: 3 })
    expect(server.reviews.size).toBe(3)
  })

  it('refuses to upload into a different account than the one that owns the device data', async () => {
    const { server, device, importer } = setup()
    await seedDevice(device, [practise(A, 'v-hello', [true])])
    const plan = (await importer.inspect(A))!
    server.sessionUserId = B
    await expect(importer.run(plan, { consent: true })).rejects.toThrow(LocalImportRefusedError)
    await expect(importer.inspect(A)).rejects.toThrow(LocalImportRefusedError)
    expect(server.reviews.size).toBe(0)
  })

  it('keeps newer server progress when the device copy is older', async () => {
    const { server, device, importer } = setup()
    const old = practise(A, 'v-hello', [false, false], T0)
    await seedDevice(device, [old])
    // The account already practised this word later, on another device.
    await server.api().recordReviews(A, [{ id: 'rev-server-0001', entry_id: 'v-hello', mode_id: 'meaning_choice', skill: 'recognition', correct: true, hint_used: false, reviewed_at: new Date(T0 + 20 * DAY_MS).toISOString() }], 'live')
    const before = server.states.get(`${A}:v-hello`)
    const plan = (await importer.inspect(A))!
    expect(plan.upload).toEqual([])
    await importer.run(plan, { consent: true })
    expect(server.states.get(`${A}:v-hello`)).toEqual(before)
  })

  it('can discard the device copy without uploading', async () => {
    const { server, device, importer } = setup()
    await seedDevice(device, [practise(A, 'v-hello', [true])])
    await importer.discard(A)
    expect(await device.listStates(A)).toEqual([])
    expect(server.reviews.size).toBe(0)
  })
})
