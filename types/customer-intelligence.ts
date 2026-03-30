// types/customer-intelligence.ts — Customer Intelligence, Sentiment & AI Nurturing types

export type SentimentLevel = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative'

export type ChurnRisk = 'low' | 'medium' | 'high' | 'churned' | 'unknown'

export type NurturingType =
  | 'reactivation'
  | 'seasonal'
  | 'upsell'
  | 'cross_sell'
  | 'follow_up'
  | 'sentiment_recovery'

export type NurturingUrgency = 'low' | 'medium' | 'high' | 'critical'

export type NurturingStatus = 'pending' | 'approved' | 'sent' | 'dismissed' | 'snoozed'

export type NurturingChannel = 'whatsapp' | 'email'

export type TriggerEvent = 'on_enter' | 'on_exit'

export type TriggerActionType =
  | 'send_email'
  | 'send_whatsapp'
  | 'create_activity'
  | 'notify_team'
  | 'add_tag'

export interface ProductPreference {
  name: string
  category: string
  count: number
  last_date: string
}

export interface CategoryPreference {
  category: string
  count: number
  revenue: number
}

export interface PeakMonth {
  month: number // 1-12
  deals_count: number
  revenue: number
}

export interface SentimentEntry {
  timestamp: string
  score: number
  trigger: string // preview of message that triggered
}

export interface ClosingFactors {
  sentiment: number     // 0-100
  engagement: number    // 0-100
  qualification: number // 0-100
  stage_velocity: number // 0-100
  rfm: number           // 0-100
}

export interface ContactBehavioralProfile {
  id: string
  contact_id: string
  organization_id: string
  avg_ticket: number
  total_revenue: number
  deals_won_count: number
  preferred_products: ProductPreference[]
  preferred_categories: CategoryPreference[]
  peak_months: PeakMonth[]
  rfm_recency: number
  rfm_frequency: number
  rfm_monetary: number
  churn_risk: ChurnRisk
  days_since_last_purchase: number
  last_purchase_date: string | null
  best_contact_days: number[]
  best_contact_hours: number[]
  response_rate: number
  ai_insights: Record<string, unknown>
  last_computed_at: string
  created_at: string
  updated_at: string
}

export interface NurturingSuggestion {
  id: string
  contact_id: string
  organization_id: string
  deal_id: string | null
  type: NurturingType
  urgency: NurturingUrgency
  title: string
  reason: string
  suggested_message: string
  channel: NurturingChannel
  auto_send: boolean
  status: NurturingStatus
  snoozed_until: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
  // Joined fields
  contact_name?: string
  contact_phone?: string
  deal_title?: string
}

export interface TriggerAction {
  type: TriggerActionType
  config: Record<string, unknown>
}

export interface PipelineTrigger {
  id: string
  organization_id: string
  board_id: string
  stage_id: string
  trigger_event: TriggerEvent
  actions: TriggerAction[]
  active: boolean
  created_at: string
  updated_at: string
  // Joined
  stage_label?: string
}

export interface StageSegment {
  type: 'pipeline_stage'
  board_id: string
  stage_ids: string[]
}

export interface ReactivationSegment {
  type: 'reactivation'
  inactive_days: number
}

export interface ReadyForProposalSegment {
  type: 'ready_for_proposal'
  min_probability: number
}

export type ExtendedSegment = StageSegment | ReactivationSegment | ReadyForProposalSegment
