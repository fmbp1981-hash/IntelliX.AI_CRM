// lib/supabase/customer-intelligence.ts
import { createClient } from './client'
import type { ContactBehavioralProfile } from '@/types/customer-intelligence'

export const customerIntelligenceService = {
  async getProfile(contactId: string): Promise<ContactBehavioralProfile | null> {
    const supabase = await createClient()
    const { data, error } = await supabase
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
    const supabase = await createClient()
    let query = supabase
      .from('contact_behavioral_profile')
      .select('*')
      .order('last_computed_at', { ascending: false })

    if (filters?.churn_risk) {
      query = query.eq('churn_risk', filters.churn_risk)
    }
    if (filters?.min_rfm) {
      const minScore = filters.min_rfm
      query = query.gte('rfm_recency', Math.ceil(minScore / 3))
    }
    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query
    if (error) throw error
    return data ?? []
  },
}
