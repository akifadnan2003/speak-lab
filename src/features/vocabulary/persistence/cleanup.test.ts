import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { activateLocalUser, clearLocalStudentData, deactivateLocalUser } from '@/lib/local-data'
import { createInitialState, schedule } from '../srs/scheduler'
import { clearVocabularyDeviceData, ensureVocabularyCleanupRegistered, resetVocabularyCleanupForTests, trackVocabularyRepository } from './cleanup'
import { createCloudVocabularyRepository } from './cloud'
import { createLocalStorageVocabularyRepository } from './local-storage'
import { createVocabularyOutbox } from './outbox'
import { createFakeVocabularyServer } from './testing/fake-api'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

function vocabKeys() {
  return Object.keys(localStorage).filter((k) => k.startsWith('speaklab.vocab'))
}

async function seed(studentId: string, server: ReturnType<typeof createFakeVocabularyServer>) {
  const at = new Date()
  const { state, quality } = schedule(createInitialState(studentId, 'v-hello', at), { skill: 'recognition', correct: true, now: at })
  const review = {
    id: `rev-clean-${studentId.slice(0, 4)}`,
    studentId,
    entryId: 'v-hello',
    modeId: 'meaning_choice',
    skill: 'recognition' as const,
    correct: true,
    quality,
    hintUsed: false,
    reviewedAt: at.toISOString(),
    intervalDaysAfter: state.intervalDays,
    stageAfter: state.stage,
  }
  await createLocalStorageVocabularyRepository().upsertState(state)
  server.online = false
  const cloud = createCloudVocabularyRepository({
    api: server.api(),
    getSessionUserId: async () => server.sessionUserId,
    outbox: createVocabularyOutbox(localStorage),
    scheduleRetry: () => () => undefined,
  })
  trackVocabularyRepository(cloud)
  await cloud.upsertState(state)
  await cloud.recordReview(review) // queued offline
  return cloud
}

beforeEach(() => {
  localStorage.clear()
  resetVocabularyCleanupForTests()
  ensureVocabularyCleanupRegistered()
})
afterEach(() => {
  resetVocabularyCleanupForTests()
  deactivateLocalUser()
})

describe('vocabulary data on sign-out and account switch (M2 local-data contract)', () => {
  it('sign-out removes the device repository, the review queue and in-memory caches', async () => {
    const server = createFakeVocabularyServer()
    server.sessionUserId = A
    const cloud = await seed(A, server)
    localStorage.setItem('speaklab.theme', 'dark')
    expect(vocabKeys().sort()).toEqual([`speaklab.vocab.outbox.v1:${A}`, `speaklab.vocab.v1:${A}`])
    expect(cloud.pendingCount(A)).toBe(1)

    await clearLocalStudentData() // what AuthProvider.signOut() and SIGNED_OUT call

    expect(vocabKeys()).toEqual([])
    expect(cloud.pendingCount(A)).toBe(0)
    expect(localStorage.getItem('speaklab.theme')).toBe('dark')
    server.online = true
    await cloud.flush()
    expect(server.reviews.size).toBe(0) // nothing left to leak into the next session
  })

  it('a different account signing in purges the previous student’s vocabulary first', async () => {
    const server = createFakeVocabularyServer()
    server.sessionUserId = A
    await activateLocalUser(A)
    const cloud = await seed(A, server)

    server.sessionUserId = B
    expect(await activateLocalUser(B)).toBe(true) // what AuthProvider does when the user id changes

    expect(vocabKeys()).toEqual([])
    expect(cloud.pendingCount(A)).toBe(0)
    expect(await createLocalStorageVocabularyRepository().listStates(A)).toEqual([])
  })

  it('the same account signing in again keeps its queued answers', async () => {
    const server = createFakeVocabularyServer()
    server.sessionUserId = A
    await activateLocalUser(A)
    const cloud = await seed(A, server)
    expect(await activateLocalUser(A)).toBe(false)
    expect(cloud.pendingCount(A)).toBe(1)
  })

  it('clearVocabularyDeviceData is idempotent and leaves other features alone', () => {
    localStorage.setItem('speaklab.progress.v1:x', 'curriculum')
    localStorage.setItem('speaklab.vocab.v1:x', '{}')
    clearVocabularyDeviceData()
    clearVocabularyDeviceData()
    expect(localStorage.getItem('speaklab.progress.v1:x')).toBe('curriculum')
    expect(vocabKeys()).toEqual([])
  })
})
