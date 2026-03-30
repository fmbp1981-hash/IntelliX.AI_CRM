// lib/supabase/customer-intelligence.ts
import { createClient } from './client'
import type {
  ContactBehavioralProfile,
  NurturingSuggestion,
  NurturingStatus,
  PipelineTrigger,
  TriggerEvent,
} from '@/types/customer-intelligence'

// ─── Contact Behavioral Profile ──────────────────────────────────────────────

export const customerIntelligenceService = {
  async getProfile(contactId: string): Promise<ContactBehavioralProfile | null> {
    const supabase = createClient()
    const { data, error } = await supabase!
      .from('contact_behavioral_profile')
      .select('*')
      .eq('contact_id', contactId)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async listProfiles(filters?: {
    churn_risk?: string
    min_rfm?: number
    limit?: number
  }): Promise<ContactBehavioralProfile[]> {
    const supabase = createClient()
    let query = supabase!
      .from('contact_behavioral_profile')
      .select('*')
      .order('last_computed_at', { ascending: false })

    if (filters?.churn_risk) query = query.eq('churn_risk', filters.churn_risk)
    if (filters?.min_rfm !== undefined) query = query.gte('rfm_score', filters.min_rfm)
    if (filters?.limit) query = query.limit(filters.limit)

    const { data, error } = await query
    if (error) throw error
    return data ?? []
  },
}

// ─── Nurturing Suggestions ───────────────────────────────────────────────────

export const nurturingService = {
  async list(filters?: {
    status?: NurturingStatus
    urgency?: string
    limit?: number
  }): Promise<NurturingSuggestion[]> {
    const supabase = createClient()
    let query = supabase!
      .from('nurturing_suggestions')
      .select(`
        *,
        contacts!inner(name, phone),
        deals(title)
      `)
      .order('created_at', { ascending: false })

    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.urgency) query = query.eq('urgency', filters.urgency)
    if (filters?.limit) query = query.limit(filters.limit)

    const { data, error } = await query
    if (error) throw error

    return (data ?? []).map((row) => ({
      ...row,
      contact_name: row.contacts?.name ?? null,
      contact_phone: row.contacts?.phone ?? null,
      deal_title: row.deals?.title ?? null,
    }))
  },

  async updateStatus(
    id: string,
    status: NurturingStatus,
    extra?: { snoozed_until?: string; sent_at?: string }
  ): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase!
      .from('nurturing_suggestions')
      .update({ status, ...extra, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async dismiss(id: string): Promise<void> {
    return nurturingService.updateStatus(id, 'dismissed')
  },

  async snooze(id: string, until: string): Promise<void> {
    return nurturingService.updateStatus(id, 'snoozed', { snoozed_until: until })
  },

  async approve(id: string): Promise<void> {
    return nurturingService.updateStatus(id, 'approved')
  },

  async markSent(id: string): Promise<void> {
    return nurturingService.updateStatus(id, 'sent', { sent_at: new Date().toISOString() })
  },

  async getPendingCount(): Promise<number> {
    const supabase = createClient()
    const { count, error } = await supabase!
      .from('nurturing_suggestions')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'approved'])
    if (error) throw error
    return count ?? 0
  },
}

// ─── Pipeline Triggers ────────────────────────────────────────────────────────

export interface PipelineTriggerInput {
  board_id: string
  stage_id: string
  trigger_event: TriggerEvent
  actions: PipelineTrigger['actions']
  active?: boolean
}

export const pipelineTriggersService = {
  async list(boardId?: string): Promise<PipelineTrigger[]> {
    const supabase = createClient()
    let query = supabase!
      .from('pipeline_triggers')
      .select(`
        *,
        board_stages(label)
      `)
      .order('created_at', { ascending: true })

    if (boardId) query = query.eq('board_id', boardId)

    const { data, error } = await query
    if (error) throw error

    return (data ?? []).map((row) => ({
      ...row,
      stage_label: row.board_stages?.label ?? null,
    }))
  },

  async create(input: PipelineTriggerInput): Promise<PipelineTrigger> {
    const supabase = createClient()
    const { data, error } = await supabase!
      .from('pipeline_triggers')
      .insert({ ...input, active: input.active ?? true })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(
    id: string,
    patch: Partial<PipelineTriggerInput & { active: boolean }>
  ): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase!
      .from('pipeline_triggers')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async remove(id: string): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase!
      .from('pipeline_triggers')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  async getByStage(boardId: string, stageId: string, event: TriggerEvent): Promise<PipelineTrigger[]> {
    const supabase = createClient()
    const { data, error } = await supabase!
      .from('pipeline_triggers')
      .select('*')
      .eq('board_id', boardId)
      .eq('stage_id', stageId)
      .eq('trigger_event', event)
      .eq('active', true)
    if (error) throw error
    return data ?? []
  },
}
