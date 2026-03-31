// lib/supabase/pipeline-triggers.ts
import { createClient } from './client'
import type { PipelineTrigger, TriggerAction } from '@/types/customer-intelligence'

export const pipelineTriggersService = {
  async listByBoard(boardId: string): Promise<PipelineTrigger[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('pipeline_triggers')
      .select('*, pipeline_stages(label)')
      .eq('board_id', boardId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map((row: Record<string, unknown> & {
      pipeline_stages?: { label?: string } | null
    }) => ({
      ...(row as PipelineTrigger),
      stage_label: row.pipeline_stages?.label,
    }))
  },

  async create(trigger: {
    board_id: string
    stage_id: string
    trigger_event: string
    actions: TriggerAction[]
  }): Promise<PipelineTrigger> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('pipeline_triggers')
      .insert(trigger)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id: string, updates: Partial<PipelineTrigger>): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase
      .from('pipeline_triggers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async delete(id: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase
      .from('pipeline_triggers')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  async getActiveTriggersForStage(
    boardId: string,
    stageId: string,
    event: 'on_enter' | 'on_exit'
  ): Promise<PipelineTrigger[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
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
