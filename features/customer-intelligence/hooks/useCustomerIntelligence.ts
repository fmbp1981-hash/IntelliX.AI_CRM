'use client'

/**
 * @fileoverview Hooks: Customer Intelligence
 *
 * TanStack Query hooks para Customer Intelligence Profile,
 * Nurturing Suggestions e Pipeline Triggers.
 * Padrão SSOT: setQueryData > invalidateQueries.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  ContactBehavioralProfile,
  NurturingSuggestion,
  NurturingStatus,
  PipelineTrigger,
  TriggerEvent,
  TriggerAction,
} from '@/types/customer-intelligence'

// ── Query Keys ────────────────────────────────────────────────────────────────

export const intelligenceKeys = {
  all: ['customer-intelligence'] as const,
  profiles: () => [...intelligenceKeys.all, 'profiles'] as const,
  profile: (contactId: string) => [...intelligenceKeys.all, 'profile', contactId] as const,
  nurturing: (filters?: { status?: NurturingStatus; urgency?: string }) =>
    [...intelligenceKeys.all, 'nurturing', filters ?? {}] as const,
  nurturingPendingCount: () => [...intelligenceKeys.all, 'nurturing-pending-count'] as const,
  triggers: (boardId?: string) => [...intelligenceKeys.all, 'triggers', boardId ?? 'all'] as const,
  nurturingSettings: () => [...intelligenceKeys.all, 'nurturing-settings'] as const,
}

// ── Contact Behavioral Profile ────────────────────────────────────────────────

export function useContactIntelligenceProfile(contactId: string) {
  return useQuery<ContactBehavioralProfile | null>({
    queryKey: intelligenceKeys.profile(contactId),
    queryFn: async () => {
      const res = await fetch(`/api/customer-intelligence/${contactId}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error('Failed to fetch intelligence profile')
      return res.json()
    },
    staleTime: 5 * 60 * 1000, // 5 min
    enabled: !!contactId,
  })
}

export function useContactIntelligenceList(filters?: { churn_risk?: string; min_rfm?: number; limit?: number }) {
  return useQuery<ContactBehavioralProfile[]>({
    queryKey: intelligenceKeys.profiles(),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.churn_risk) params.set('churn_risk', filters.churn_risk)
      if (filters?.min_rfm !== undefined) params.set('min_rfm', String(filters.min_rfm))
      if (filters?.limit) params.set('limit', String(filters.limit))
      const res = await fetch(`/api/customer-intelligence?${params}`)
      if (!res.ok) throw new Error('Failed to fetch profiles')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ── Nurturing Suggestions ─────────────────────────────────────────────────────

export function useNurturingSuggestions(filters?: { status?: NurturingStatus; urgency?: string; limit?: number }) {
  return useQuery<NurturingSuggestion[]>({
    queryKey: intelligenceKeys.nurturing(filters),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.urgency) params.set('urgency', filters.urgency)
      if (filters?.limit) params.set('limit', String(filters.limit))
      const res = await fetch(`/api/nurturing?${params}`)
      if (!res.ok) throw new Error('Failed to fetch nurturing suggestions')
      return res.json()
    },
    staleTime: 60 * 1000, // 1 min
  })
}

export function useNurturingPendingCount() {
  return useQuery<{ count: number }>({
    queryKey: intelligenceKeys.nurturingPendingCount(),
    queryFn: async () => {
      const res = await fetch('/api/nurturing?status=pending&limit=1')
      if (!res.ok) return { count: 0 }
      const data: NurturingSuggestion[] = await res.json()
      // refetch real count via header or just check length of pending list
      const countRes = await fetch('/api/nurturing?status=pending&limit=200')
      if (!countRes.ok) return { count: 0 }
      const all: NurturingSuggestion[] = await countRes.json()
      return { count: all.length }
    },
    staleTime: 2 * 60 * 1000, // 2 min
  })
}

export function useApproveNurturing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/nurturing/${id}/approve`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to approve')
    },
    onSuccess: (_data, id) => {
      qc.setQueryData<NurturingSuggestion[]>(
        intelligenceKeys.nurturing({ status: 'pending' }),
        (old) => (old ?? []).map((s) => s.id === id ? { ...s, status: 'approved' as NurturingStatus } : s)
      )
      qc.invalidateQueries({ queryKey: intelligenceKeys.all })
    },
  })
}

export function useDismissNurturing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/nurturing/${id}/dismiss`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to dismiss')
    },
    onSuccess: (_data, id) => {
      qc.setQueryData<NurturingSuggestion[]>(
        intelligenceKeys.nurturing(),
        (old) => (old ?? []).filter((s) => s.id !== id)
      )
      qc.invalidateQueries({ queryKey: intelligenceKeys.all })
    },
  })
}

export function useSendNurturing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, channel, message }: { id: string; channel: 'whatsapp' | 'email'; message?: string }) => {
      const res = await fetch(`/api/nurturing/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, message }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to send')
      }
    },
    onSuccess: (_data, { id }) => {
      qc.setQueryData<NurturingSuggestion[]>(
        intelligenceKeys.nurturing(),
        (old) => (old ?? []).map((s) => s.id === id ? { ...s, status: 'sent' as NurturingStatus } : s)
      )
      qc.invalidateQueries({ queryKey: intelligenceKeys.all })
    },
  })
}

export function useSnoozeNurturing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, until }: { id: string; until: string }) => {
      const res = await fetch(`/api/nurturing/${id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ until }),
      })
      if (!res.ok) throw new Error('Failed to snooze')
    },
    onSuccess: (_data, { id }) => {
      qc.setQueryData<NurturingSuggestion[]>(
        intelligenceKeys.nurturing(),
        (old) => (old ?? []).filter((s) => s.id !== id)
      )
      qc.invalidateQueries({ queryKey: intelligenceKeys.all })
    },
  })
}

// ── Nurturing Settings ────────────────────────────────────────────────────────

export interface NurturingOrgSettings {
  nurturing_auto_mode: boolean
  nurturing_max_auto_per_day: number
}

export function useNurturingSettings() {
  return useQuery<NurturingOrgSettings>({
    queryKey: intelligenceKeys.nurturingSettings(),
    queryFn: async () => {
      const res = await fetch('/api/nurturing/settings')
      if (!res.ok) throw new Error('Failed to fetch nurturing settings')
      return res.json()
    },
    staleTime: 10 * 60 * 1000, // 10 min
  })
}

export function useUpdateNurturingSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<NurturingOrgSettings>) => {
      const res = await fetch('/api/nurturing/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('Failed to update nurturing settings')
    },
    onSuccess: (_data, patch) => {
      qc.setQueryData<NurturingOrgSettings>(intelligenceKeys.nurturingSettings(), (old) =>
        old ? { ...old, ...patch } : (patch as NurturingOrgSettings)
      )
    },
  })
}

// ── Pipeline Triggers ─────────────────────────────────────────────────────────

export function usePipelineTriggers(boardId?: string) {
  return useQuery<PipelineTrigger[]>({
    queryKey: intelligenceKeys.triggers(boardId),
    queryFn: async () => {
      const params = boardId ? `?board_id=${boardId}` : ''
      const res = await fetch(`/api/pipeline-triggers${params}`)
      if (!res.ok) throw new Error('Failed to fetch pipeline triggers')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreatePipelineTrigger() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      board_id: string
      stage_id: string
      trigger_event: TriggerEvent
      actions: TriggerAction[]
      active?: boolean
    }) => {
      const res = await fetch('/api/pipeline-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to create trigger')
      }
      return res.json() as Promise<PipelineTrigger>
    },
    onSuccess: (newTrigger) => {
      qc.setQueryData<PipelineTrigger[]>(
        intelligenceKeys.triggers(newTrigger.board_id),
        (old) => [...(old ?? []), newTrigger]
      )
    },
  })
}

export function useUpdatePipelineTrigger() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<PipelineTrigger> & { id: string }) => {
      const res = await fetch(`/api/pipeline-triggers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('Failed to update trigger')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: intelligenceKeys.all })
    },
  })
}

export function useDeletePipelineTrigger() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, boardId }: { id: string; boardId: string }) => {
      const res = await fetch(`/api/pipeline-triggers/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete trigger')
      return boardId
    },
    onSuccess: (_boardId, { id, boardId }) => {
      qc.setQueryData<PipelineTrigger[]>(
        intelligenceKeys.triggers(boardId),
        (old) => (old ?? []).filter((t) => t.id !== id)
      )
    },
  })
}
