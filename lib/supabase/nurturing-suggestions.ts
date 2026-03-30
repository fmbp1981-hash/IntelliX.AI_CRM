// lib/supabase/nurturing-suggestions.ts
import { createClient } from './client'
import type { NurturingSuggestion, NurturingStatus } from '@/types/customer-intelligence'

export const nurturingSuggestionsService = {
  async list(filters?: {
    status?: NurturingStatus
    urgency?: string
    limit?: number
  }): Promise<NurturingSuggestion[]> {
    const supabase = await createClient()
    let query = supabase
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
    return (data ?? []).map((row: Record<string, unknown> & {
      contacts?: { name?: string; phone?: string } | null
      deals?: { title?: string } | null
    }) => ({
      ...(row as NurturingSuggestion),
      contact_name: row.contacts?.name,
      contact_phone: row.contacts?.phone,
      deal_title: row.deals?.title,
    }))
  },

  async approve(id: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase
      .from('nurturing_suggestions')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async dismiss(id: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase
      .from('nurturing_suggestions')
      .update({ status: 'dismissed', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async snooze(id: string, until: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase
      .from('nurturing_suggestions')
      .update({
        status: 'snoozed',
        snoozed_until: until,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) throw error
  },

  async markSent(id: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase
      .from('nurturing_suggestions')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) throw error
  },

  async getPendingCount(): Promise<number> {
    const supabase = await createClient()
    const { count, error } = await supabase
      .from('nurturing_suggestions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
    if (error) throw error
    return count ?? 0
  },
}
