import { mkdirSync, writeFileSync } from 'node:fs'
import { adminClient, ensureTutor, localStack } from '../supabase/tests/helpers.ts'

export const TUTOR_STATE_FILE = 'test-results/auth-tutor.json'

/** Creates the tutor through the documented bootstrap path and records its credentials for the spec. */
export default async function globalSetup() {
  const stack = localStack()
  const admin = adminClient()
  const tutor = await ensureTutor(admin)
  mkdirSync('test-results', { recursive: true })
  writeFileSync(TUTOR_STATE_FILE, JSON.stringify({ ...tutor, mailpitUrl: stack.mailpitUrl }), 'utf8')
}
