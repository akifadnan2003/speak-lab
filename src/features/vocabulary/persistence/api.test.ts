import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { createSupabaseVocabularyApi, unwrap, VocabularySyncError } from './api'

describe('response classification', () => {
  const err = (status: number, code = '') => ({ data: null, error: { message: 'x', code }, status })

  it('treats offline, timeouts, rate limits, 5xx and expired JWTs as transient', () => {
    for (const r of [err(0), err(408), err(429), err(503), err(401), err(400, 'PGRST301')]) {
      try {
        unwrap(r)
        expect.unreachable()
      } catch (e) {
        expect(e).toBeInstanceOf(VocabularySyncError)
        expect((e as VocabularySyncError).transient).toBe(true)
      }
    }
  })

  it('treats account mismatches and malformed requests as permanent', () => {
    expect(() => unwrap(err(403, '42501'))).toThrow(expect.objectContaining({ kind: 'account', transient: false }))
    expect(() => unwrap(err(400, '22023'))).toThrow(expect.objectContaining({ kind: 'invalid', transient: false }))
  })

  it('returns data on success', () => {
    expect(unwrap({ data: [1], error: null, status: 200 })).toEqual([1])
  })
})

/** Records the PostgREST calls the adapter makes, so query shapes are pinned down. */
function recordingClient(pages: unknown[][] = [[]]) {
  const log: string[] = []
  let page = 0
  const builder = (table: string) => {
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'lte', 'gte', 'order']) {
      chain[m] = (...args: unknown[]) => {
        log.push(`${table}.${m}(${args.map((a) => JSON.stringify(a)).join(',')})`)
        return chain
      }
    }
    chain.range = (from: number, to: number) => {
      log.push(`${table}.range(${from},${to})`)
      return Promise.resolve({ data: pages[page++] ?? [], error: null, status: 200 })
    }
    chain.maybeSingle = () => Promise.resolve({ data: { reset_at: null }, error: null, status: 200 })
    return chain
  }
  const client = {
    from: (table: string) => builder(table),
    rpc: (fn: string, args: unknown) => {
      log.push(`rpc ${fn} ${JSON.stringify(args)}`)
      return Promise.resolve({ data: { results: [], states: [], reset_at: null }, error: null, status: 200 })
    },
  }
  return { client: client as unknown as SupabaseClient, log }
}

describe('Supabase vocabulary adapter', () => {
  it('reads only the requested student’s rows and pages past the 1000-row API limit', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ id: i }))
    const { client, log } = recordingClient([full, [{ id: 'last' }]])
    const rows = await createSupabaseVocabularyApi(client).fetchReviews('uid-1')
    expect(rows).toHaveLength(1001)
    expect(log).toContain('vocabulary_reviews.eq("student_id","uid-1")')
    expect(log).toContain('vocabulary_reviews.is("voided_at",null)')
    expect(log.filter((l) => l.includes('.range('))).toEqual(['vocabulary_reviews.range(0,999)', 'vocabulary_reviews.range(1000,1999)'])
  })

  it('filters due words on the server', async () => {
    const { client, log } = recordingClient()
    await createSupabaseVocabularyApi(client).fetchStates('uid-1', { dueBefore: '2026-11-11T00:00:00.000Z' })
    expect(log).toContain('student_vocabulary.lte("due_at","2026-11-11T00:00:00.000Z")')
  })

  it('calls the review function with the expected owner and never a student id to act as', async () => {
    const { client, log } = recordingClient()
    await createSupabaseVocabularyApi(client).recordReviews('uid-1', [], 'live')
    await createSupabaseVocabularyApi(client).reset('uid-1')
    expect(log).toEqual([
      'rpc record_vocabulary_reviews {"p_expected_student":"uid-1","p_reviews":[],"p_source":"live"}',
      'rpc reset_vocabulary_progress {"p_expected_student":"uid-1"}',
    ])
  })

  it('turns thrown fetch failures into transient network errors', async () => {
    const client = { rpc: () => Promise.reject(new TypeError('Failed to fetch')) } as unknown as SupabaseClient
    await expect(createSupabaseVocabularyApi(client).reset('uid-1')).rejects.toMatchObject({ kind: 'network', transient: true })
  })
})
