import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

async function throwOnError(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

export function useClubs() {
  return useQuery({
    queryKey: ['clubs'],
    queryFn: () => throwOnError(supabase.rpc('profit_clubs')),
  })
}

export function useMyRole() {
  return useQuery({
    queryKey: ['my-role'],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth?.user) return null
      const data = await throwOnError(
        supabase.from('profit_members').select('role').eq('user_id', auth.user.id).maybeSingle()
      )
      return data?.role ?? null
    },
  })
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => throwOnError(supabase.from('profit_club_settings').select('*')),
  })
}

export function useEntries() {
  return useQuery({
    queryKey: ['entries'],
    queryFn: () =>
      throwOnError(
        supabase.from('profit_monthly_entries').select('*').order('month', { ascending: true })
      ),
  })
}

export function useScenarios() {
  return useQuery({
    queryKey: ['scenarios'],
    queryFn: () =>
      throwOnError(
        supabase.from('profit_scenarios').select('*').order('updated_at', { ascending: false })
      ),
  })
}

export function useUpsertEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entry) => {
      const { data: auth } = await supabase.auth.getUser()
      return throwOnError(
        supabase
          .from('profit_monthly_entries')
          .upsert({ ...entry, created_by: entry.created_by ?? auth?.user?.id }, { onConflict: 'club_id,month' })
          .select()
          .single()
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entries'] }),
  })
}

export function useUpsertSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (settings) =>
      throwOnError(
        supabase.from('profit_club_settings').upsert(settings, { onConflict: 'club_id' }).select().single()
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}

export function useSaveScenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name, club_id, data }) => {
      const { data: auth } = await supabase.auth.getUser()
      const row = { name, club_id: club_id || null, data, created_by: auth?.user?.id }
      if (id) {
        return throwOnError(
          supabase.from('profit_scenarios').update(row).eq('id', id).select().single()
        )
      }
      return throwOnError(supabase.from('profit_scenarios').insert(row).select().single())
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios'] }),
  })
}

export function useDeleteScenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => throwOnError(supabase.from('profit_scenarios').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios'] }),
  })
}
