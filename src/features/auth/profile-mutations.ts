import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { ProfileUpdate, SupportLanguage } from '@/lib/supabase/database.types'
import { PROFILE_QUERY_KEY } from './profile'
import type { StudentPreferences } from './types'

export interface ProfileChanges {
  fullName?: string
  supportLanguage?: SupportLanguage
  preferences?: StudentPreferences
}

function toUpdate(changes: ProfileChanges): ProfileUpdate {
  const update: ProfileUpdate = {}
  if (changes.fullName !== undefined) update.full_name = changes.fullName.trim()
  if (changes.supportLanguage !== undefined) update.support_language = changes.supportLanguage
  if (changes.preferences !== undefined) update.preferences = { ...changes.preferences }
  return update
}

/** Updates the caller's own profile row (RLS + column grants restrict what can change). */
export function useUpdateProfile(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (changes: ProfileChanges) => {
      const client = getSupabaseClient()
      if (!client) throw new Error('Authentication is not configured in this build.')
      const { error } = await client.from('profiles').update(toUpdate(changes)).eq('id', userId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY }),
  })
}

/** Marks onboarding complete (server sets the timestamp once). */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const client = getSupabaseClient()
      if (!client) throw new Error('Authentication is not configured in this build.')
      const { error } = await client.rpc('complete_onboarding')
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY }),
  })
}
