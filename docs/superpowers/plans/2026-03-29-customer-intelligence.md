# Customer Intelligence + Sentiment Analysis + AI Nurturing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistema de perfil comportamental de clientes com analise de sentimento, probabilidade de fechamento, nurturing inteligente e automacao de pipeline.

**Architecture:** 5 novas tabelas (contact_behavioral_profile, nurturing_suggestions, pipeline_triggers + alteracoes em deals e conversations), 2 Edge Functions (compute-contact-profiles, generate-nurturing-suggestions), Step 14.5 no Agent Engine para sentiment, pagina /nutricao, badges visuais no Kanban, segmentacao por stage em campanhas, triggers de pipeline.

**Tech Stack:** Next.js 16, TypeScript strict, Supabase PostgreSQL + pgvector, Vercel AI SDK v6, TanStack Query v5, Zustand, Tailwind CSS v4, Zod

**Spec:** `docs/superpowers/specs/2026-03-28-customer-intelligence-design.md`

---

## File Structure

### New Files
```
supabase/migrations/20260329000001_customer_intelligence.sql
supabase/migrations/20260329000002_nurturing_and_triggers.sql
supabase/functions/compute-contact-profiles/index.ts
supabase/functions/generate-nurturing-suggestions/index.ts
types/customer-intelligence.ts
lib/supabase/customer-intelligence.ts
lib/supabase/nurturing-suggestions.ts
lib/supabase/pipeline-triggers.ts
lib/query/hooks/useCustomerIntelligence.ts
lib/query/hooks/useNurturingSuggestions.ts
lib/ai/sentiment.ts
lib/ai/closing-probability.ts
features/boards/components/Kanban/SentimentBadge.tsx
features/boards/components/Kanban/ClosingBadge.tsx
features/contacts/components/ContactIntelligencePanel.tsx
features/nurturing/NurturingDashboard.tsx
features/nurturing/components/SuggestionCard.tsx
features/nurturing/components/NurturingFilters.tsx
features/nurturing/hooks/useNurturing.ts
features/campaigns/components/StageSegmentFilter.tsx
features/settings/components/PipelineTriggersBuilder.tsx
app/(protected)/nutricao/page.tsx
app/api/customer-intelligence/route.ts
app/api/customer-intelligence/[contactId]/route.ts
app/api/nurturing/route.ts
app/api/nurturing/[id]/approve/route.ts
app/api/nurturing/[id]/dismiss/route.ts
app/api/nurturing/settings/route.ts
app/api/pipeline-triggers/route.ts
app/api/pipeline-triggers/[id]/route.ts
test/customer-intelligence.test.ts
test/sentiment.test.ts
test/nurturing.test.ts
```

### Modified Files
```
types/types.ts              (Deal: +product_name, +product_category, +closing_probability, +closing_factors)
types/agent.ts              (Conversation: extend sentiment enum to 5 levels, +sentiment_score, +sentiment_history)
lib/query/queryKeys.ts      (add customerIntelligence, nurturing, pipelineTriggers keys)
lib/supabase/index.ts       (export new services)
lib/supabase/email-campaigns.ts (add pipeline_stage segment type)
features/boards/components/Kanban/DealCard.tsx  (add SentimentBadge + ClosingBadge)
features/campaigns/CampaignsManager.tsx         (add StageSegmentFilter)
features/settings/SettingsPage.tsx              (add Pipeline Triggers tab)
components/navigation/NavigationRail.tsx         (add /nutricao link)
components/navigation/BottomNav.tsx              (add /nutricao link)
supabase/functions/agent-engine/index.ts         (add Step 14.5: sentiment + closing)
app/api/campaigns/segment-preview/route.ts       (handle pipeline_stage segment)
```

---

## Task 1: Migration — Customer Intelligence Schema

**Files:**
- Create: `supabase/migrations/20260329000001_customer_intelligence.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/20260329000001_customer_intelligence.sql

-- 1. Extend deals with product and closing fields
ALTER TABLE deals ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS product_category TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS closing_probability INT DEFAULT 0
  CHECK (closing_probability BETWEEN 0 AND 100);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS closing_factors JSONB DEFAULT '{}';

-- 2. Extend conversations with enhanced sentiment
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS sentiment_score INT DEFAULT 0
  CHECK (sentiment_score BETWEEN -100 AND 100);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS sentiment_history JSONB DEFAULT '[]';

-- Update sentiment column to support 5 levels (was 3)
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_sentiment_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_sentiment_check
  CHECK (sentiment IN ('very_positive', 'positive', 'neutral', 'negative', 'very_negative'));

-- 3. Create contact_behavioral_profile
CREATE TABLE IF NOT EXISTS contact_behavioral_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  avg_ticket NUMERIC(12,2) DEFAULT 0,
  total_revenue NUMERIC(12,2) DEFAULT 0,
  deals_won_count INT DEFAULT 0,

  preferred_products JSONB DEFAULT '[]',
  preferred_categories JSONB DEFAULT '[]',
  peak_months JSONB DEFAULT '[]',

  rfm_recency INT DEFAULT 1 CHECK (rfm_recency BETWEEN 1 AND 5),
  rfm_frequency INT DEFAULT 1 CHECK (rfm_frequency BETWEEN 1 AND 5),
  rfm_monetary INT DEFAULT 1 CHECK (rfm_monetary BETWEEN 1 AND 5),

  churn_risk TEXT DEFAULT 'unknown'
    CHECK (churn_risk IN ('low', 'medium', 'high', 'churned', 'unknown')),
  days_since_last_purchase INT DEFAULT 0,
  last_purchase_date TIMESTAMPTZ,

  best_contact_days INT[] DEFAULT '{}',
  best_contact_hours INT[] DEFAULT '{}',
  response_rate NUMERIC(5,2) DEFAULT 0,

  ai_insights JSONB DEFAULT '{}',

  last_computed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(contact_id)
);

ALTER TABLE contact_behavioral_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_cbp" ON contact_behavioral_profile
  FOR ALL USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX idx_cbp_org ON contact_behavioral_profile(organization_id);
CREATE INDEX idx_cbp_rfm ON contact_behavioral_profile(organization_id, rfm_recency DESC, rfm_frequency DESC, rfm_monetary DESC);
CREATE INDEX idx_cbp_churn ON contact_behavioral_profile(organization_id, churn_risk);
CREATE INDEX idx_cbp_contact ON contact_behavioral_profile(contact_id);

-- 4. Indexes for deals new columns
CREATE INDEX IF NOT EXISTS idx_deals_closing ON deals(organization_id, closing_probability DESC);
CREATE INDEX IF NOT EXISTS idx_deals_product_cat ON deals(organization_id, product_category);
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db push` or apply via Supabase dashboard.
Expected: All tables created, columns added, RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260329000001_customer_intelligence.sql
git commit -m "feat: migration customer intelligence schema — profile, sentiment, closing probability"
```

---

## Task 2: Migration — Nurturing Suggestions + Pipeline Triggers

**Files:**
- Create: `supabase/migrations/20260329000002_nurturing_and_triggers.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/20260329000002_nurturing_and_triggers.sql

-- 1. Nurturing suggestions
CREATE TABLE IF NOT EXISTS nurturing_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,

  type TEXT NOT NULL
    CHECK (type IN ('reactivation', 'seasonal', 'upsell', 'cross_sell', 'follow_up', 'sentiment_recovery')),
  urgency TEXT NOT NULL DEFAULT 'medium'
    CHECK (urgency IN ('low', 'medium', 'high', 'critical')),

  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  suggested_message TEXT NOT NULL,
  channel TEXT DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'email')),

  auto_send BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'sent', 'dismissed', 'snoozed')),

  snoozed_until TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE nurturing_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_ns" ON nurturing_suggestions
  FOR ALL USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX idx_ns_org_status ON nurturing_suggestions(organization_id, status);
CREATE INDEX idx_ns_contact ON nurturing_suggestions(contact_id);
CREATE INDEX idx_ns_urgency ON nurturing_suggestions(organization_id, urgency, status);

-- 2. Pipeline triggers
CREATE TABLE IF NOT EXISTS pipeline_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,

  trigger_event TEXT NOT NULL DEFAULT 'on_enter'
    CHECK (trigger_event IN ('on_enter', 'on_exit')),

  actions JSONB NOT NULL DEFAULT '[]',

  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pipeline_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation_pt" ON pipeline_triggers
  FOR ALL USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX idx_pt_board_stage ON pipeline_triggers(board_id, stage_id, trigger_event);

-- 3. Add nurturing settings to organization settings
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS nurturing_auto_mode BOOLEAN DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS nurturing_max_auto_per_day INT DEFAULT 2;
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db push`
Expected: Tables created, RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260329000002_nurturing_and_triggers.sql
git commit -m "feat: migration nurturing suggestions + pipeline triggers schema"
```

---

## Task 3: TypeScript Types

**Files:**
- Create: `types/customer-intelligence.ts`
- Modify: `types/types.ts`
- Modify: `types/agent.ts`

- [ ] **Step 1: Create customer-intelligence types**

```typescript
// types/customer-intelligence.ts

export type SentimentLevel = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative'

export type ChurnRisk = 'low' | 'medium' | 'high' | 'churned' | 'unknown'

export type NurturingType = 'reactivation' | 'seasonal' | 'upsell' | 'cross_sell' | 'follow_up' | 'sentiment_recovery'

export type NurturingUrgency = 'low' | 'medium' | 'high' | 'critical'

export type NurturingStatus = 'pending' | 'approved' | 'sent' | 'dismissed' | 'snoozed'

export type NurturingChannel = 'whatsapp' | 'email'

export type TriggerEvent = 'on_enter' | 'on_exit'

export type TriggerActionType = 'send_email' | 'send_whatsapp' | 'create_activity' | 'notify_team' | 'add_tag'

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
  sentiment: number    // 0-100
  engagement: number   // 0-100
  qualification: number // 0-100
  stage_velocity: number // 0-100
  rfm: number          // 0-100
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
```

- [ ] **Step 2: Update Deal type in types/types.ts**

Add after the existing `lossReason` field in the Deal interface:

```typescript
  // Customer Intelligence fields
  productName?: string;
  productCategory?: string;
  closingProbability?: number;
  closingFactors?: import('./customer-intelligence').ClosingFactors;
```

- [ ] **Step 3: Update Conversation type in types/agent.ts**

Update the `sentiment` field type and add new fields after `sentiment`:

```typescript
  sentiment: import('../customer-intelligence').SentimentLevel;
  sentimentScore: number;
  sentimentHistory: import('../customer-intelligence').SentimentEntry[];
```

- [ ] **Step 4: Export from types/index.ts**

Add line:
```typescript
export * from './customer-intelligence'
```

- [ ] **Step 5: Commit**

```bash
git add types/customer-intelligence.ts types/types.ts types/agent.ts types/index.ts
git commit -m "feat: TypeScript types for customer intelligence, sentiment, nurturing, pipeline triggers"
```

---

## Task 4: Query Keys + Supabase Services

**Files:**
- Modify: `lib/query/queryKeys.ts`
- Create: `lib/supabase/customer-intelligence.ts`
- Create: `lib/supabase/nurturing-suggestions.ts`
- Create: `lib/supabase/pipeline-triggers.ts`
- Modify: `lib/supabase/index.ts`

- [ ] **Step 1: Add query keys**

Add to `queryKeys` object in `lib/query/queryKeys.ts`:

```typescript
  customerIntelligence: createExtendedQueryKeys('customerIntelligence', base => ({
    byContact: (contactId: string) => [...base.all, 'contact', contactId] as const,
  })),
  nurturing: createExtendedQueryKeys('nurturing', base => ({
    pending: () => [...base.all, 'pending'] as const,
    byUrgency: (urgency: string) => [...base.all, 'urgency', urgency] as const,
  })),
  pipelineTriggers: createExtendedQueryKeys('pipelineTriggers', base => ({
    byBoard: (boardId: string) => [...base.all, 'board', boardId] as const,
  })),
```

- [ ] **Step 2: Create customer-intelligence service**

```typescript
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
```

- [ ] **Step 3: Create nurturing-suggestions service**

```typescript
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
    return (data ?? []).map(row => ({
      ...row,
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
```

- [ ] **Step 4: Create pipeline-triggers service**

```typescript
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
    return (data ?? []).map(row => ({
      ...row,
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
```

- [ ] **Step 5: Export from lib/supabase/index.ts**

Add lines:
```typescript
export { customerIntelligenceService } from './customer-intelligence'
export { nurturingSuggestionsService } from './nurturing-suggestions'
export { pipelineTriggersService } from './pipeline-triggers'
```

- [ ] **Step 6: Commit**

```bash
git add lib/query/queryKeys.ts lib/supabase/customer-intelligence.ts lib/supabase/nurturing-suggestions.ts lib/supabase/pipeline-triggers.ts lib/supabase/index.ts
git commit -m "feat: query keys + Supabase services for customer intelligence, nurturing, pipeline triggers"
```

---

## Task 5: Sentiment Analysis + Closing Probability (AI Layer)

**Files:**
- Create: `lib/ai/sentiment.ts`
- Create: `lib/ai/closing-probability.ts`

- [ ] **Step 1: Create sentiment analysis module**

```typescript
// lib/ai/sentiment.ts
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import type { SentimentLevel } from '@/types/customer-intelligence'

const sentimentSchema = z.object({
  sentiment: z.enum(['very_positive', 'positive', 'neutral', 'negative', 'very_negative']),
  score: z.number().min(-100).max(100),
  reason: z.string().max(100),
})

export type SentimentResult = z.infer<typeof sentimentSchema>

export async function analyzeSentiment(message: string): Promise<SentimentResult> {
  const { object } = await generateObject({
    model: anthropic('claude-haiku-4-5-20251001'),
    schema: sentimentSchema,
    prompt: `Classifique o sentimento desta mensagem de cliente em pt-BR.
Escala: very_positive (+80 a +100), positive (+30 a +79), neutral (-29 a +29), negative (-79 a -30), very_negative (-100 a -80).
Score: numero de -100 a +100.
Reason: max 100 chars, motivo principal.

Mensagem: "${message}"`,
  })
  return object
}

export function sentimentToEmoji(sentiment: SentimentLevel): string {
  const map: Record<SentimentLevel, string> = {
    very_positive: '😄',
    positive: '🙂',
    neutral: '😐',
    negative: '😟',
    very_negative: '😠',
  }
  return map[sentiment]
}

export function sentimentToColor(sentiment: SentimentLevel): string {
  const map: Record<SentimentLevel, string> = {
    very_positive: 'text-green-500',
    positive: 'text-green-400',
    neutral: 'text-yellow-500',
    negative: 'text-orange-500',
    very_negative: 'text-red-500',
  }
  return map[sentiment]
}
```

- [ ] **Step 2: Create closing probability calculator**

```typescript
// lib/ai/closing-probability.ts
import type { ClosingFactors, SentimentLevel } from '@/types/customer-intelligence'

interface ClosingInput {
  sentimentScore: number          // -100 to 100
  messagesFromClient: number
  totalMessages: number
  qualificationFieldsFilled: number
  qualificationFieldsTotal: number
  daysInCurrentStage: number
  rfmScore: number               // 3-15
}

const DEFAULT_WEIGHTS = {
  sentiment: 0.25,
  engagement: 0.20,
  qualification: 0.25,
  stage_velocity: 0.15,
  rfm: 0.15,
}

export function calculateClosingProbability(
  input: ClosingInput,
  weights = DEFAULT_WEIGHTS
): { probability: number; factors: ClosingFactors } {
  // Normalize sentiment from [-100, 100] to [0, 100]
  const sentimentFactor = Math.round((input.sentimentScore + 100) / 2)

  // Engagement: ratio of client responses
  const engagementFactor = input.totalMessages > 0
    ? Math.round((input.messagesFromClient / input.totalMessages) * 100)
    : 0

  // Qualification: fields filled ratio
  const qualificationFactor = input.qualificationFieldsTotal > 0
    ? Math.round((input.qualificationFieldsFilled / input.qualificationFieldsTotal) * 100)
    : 50 // default if no required fields

  // Stage velocity: penalize stagnation (100 - 5 per day, min 0)
  const stageVelocityFactor = Math.max(0, 100 - input.daysInCurrentStage * 5)

  // RFM: normalize from [3, 15] to [0, 100]
  const rfmFactor = Math.round(((input.rfmScore - 3) / 12) * 100)

  const factors: ClosingFactors = {
    sentiment: sentimentFactor,
    engagement: engagementFactor,
    qualification: qualificationFactor,
    stage_velocity: stageVelocityFactor,
    rfm: rfmFactor,
  }

  const probability = Math.round(
    factors.sentiment * weights.sentiment +
    factors.engagement * weights.engagement +
    factors.qualification * weights.qualification +
    factors.stage_velocity * weights.stage_velocity +
    factors.rfm * weights.rfm
  )

  return {
    probability: Math.max(0, Math.min(100, probability)),
    factors,
  }
}

export function closingProbabilityColor(probability: number): string {
  if (probability >= 70) return 'text-green-500'
  if (probability >= 30) return 'text-yellow-500'
  return 'text-red-500'
}

export function closingProbabilityLabel(probability: number): string {
  if (probability >= 70) return 'Alta'
  if (probability >= 30) return 'Media'
  return 'Baixa'
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/ai/sentiment.ts lib/ai/closing-probability.ts
git commit -m "feat: sentiment analysis + closing probability calculator"
```

---

## Task 6: Agent Engine — Step 14.5 (Sentiment + Closing)

**Files:**
- Modify: `supabase/functions/agent-engine/index.ts`

- [ ] **Step 1: Read the current agent-engine**

Read `supabase/functions/agent-engine/index.ts` to locate the section after Step 9 (Generate AI Response) where the response is sent back.

- [ ] **Step 2: Add sentiment analysis after AI response generation**

After the AI response is generated and before sending back, add Step 14.5. Find the section where `aiResponse` is finalized (after the `generateText` or `streamText` call) and add:

```typescript
// ========== Step 14.5: Sentiment Analysis + Closing Probability ==========
try {
  // Analyze sentiment of the LAST USER MESSAGE (not AI response)
  const sentimentPrompt = `Classifique o sentimento: very_positive(+80/+100), positive(+30/+79), neutral(-29/+29), negative(-79/-30), very_negative(-100/-80). Msg: "${userMessage}"`;

  const sentimentResult = await generateObject({
    model: anthropic('claude-haiku-4-5-20251001'),
    schema: z.object({
      sentiment: z.enum(['very_positive', 'positive', 'neutral', 'negative', 'very_negative']),
      score: z.number().min(-100).max(100),
    }),
    prompt: sentimentPrompt,
  });

  const newSentiment = sentimentResult.object;

  // Update conversation sentiment
  const sentimentEntry = {
    timestamp: new Date().toISOString(),
    score: newSentiment.score,
    trigger: userMessage.slice(0, 80),
  };

  const { data: convData } = await supabase
    .from('conversations')
    .select('sentiment_history')
    .eq('id', conversationId)
    .single();

  const history = Array.isArray(convData?.sentiment_history)
    ? [...convData.sentiment_history, sentimentEntry].slice(-20) // keep last 20
    : [sentimentEntry];

  await supabase.from('conversations').update({
    sentiment: newSentiment.sentiment,
    sentiment_score: newSentiment.score,
    sentiment_history: history,
  }).eq('id', conversationId);

  // Update closing probability on associated deal
  if (dealId) {
    // Get profile data
    const { data: profile } = await supabase
      .from('contact_behavioral_profile')
      .select('rfm_recency, rfm_frequency, rfm_monetary')
      .eq('contact_id', contactId)
      .maybeSingle();

    const rfmScore = profile
      ? profile.rfm_recency + profile.rfm_frequency + profile.rfm_monetary
      : 9; // default mid

    // Count messages
    const { count: totalMsgs } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId);

    const { count: clientMsgs } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('role', 'user');

    // Get deal stage info
    const { data: deal } = await supabase
      .from('deals')
      .select('status, last_stage_change_date')
      .eq('id', dealId)
      .single();

    const daysInStage = deal?.last_stage_change_date
      ? Math.floor((Date.now() - new Date(deal.last_stage_change_date).getTime()) / 86400000)
      : 0;

    // Qualification fields count
    const qualFilled = Object.values(qualificationData || {}).filter(Boolean).length;
    const qualTotal = Math.max(qualFilled, 4); // at least 4 expected

    // Calculate
    const sentimentFactor = Math.round((newSentiment.score + 100) / 2);
    const engagementFactor = (totalMsgs ?? 1) > 0 ? Math.round(((clientMsgs ?? 0) / (totalMsgs ?? 1)) * 100) : 0;
    const qualificationFactor = qualTotal > 0 ? Math.round((qualFilled / qualTotal) * 100) : 50;
    const stageVelocityFactor = Math.max(0, 100 - daysInStage * 5);
    const rfmFactor = Math.round(((rfmScore - 3) / 12) * 100);

    const factors = { sentiment: sentimentFactor, engagement: engagementFactor, qualification: qualificationFactor, stage_velocity: stageVelocityFactor, rfm: rfmFactor };
    const probability = Math.max(0, Math.min(100, Math.round(
      factors.sentiment * 0.25 + factors.engagement * 0.20 +
      factors.qualification * 0.25 + factors.stage_velocity * 0.15 +
      factors.rfm * 0.15
    )));

    await supabase.from('deals').update({
      closing_probability: probability,
      closing_factors: factors,
    }).eq('id', dealId);
  }

  // Escalation: 3 consecutive very_negative
  const recentNegative = history.slice(-3);
  if (recentNegative.length === 3 && recentNegative.every(e => e.score <= -80)) {
    console.log(`[Sentiment Escalation] Conv ${conversationId}: 3x very_negative, recommending human handoff`);
    // The AI response will naturally adjust based on the negative context
  }
} catch (sentimentError) {
  console.error('[Step 14.5] Sentiment analysis failed (non-blocking):', sentimentError);
  // Non-blocking: sentiment failure should not break the response flow
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/agent-engine/index.ts
git commit -m "feat: agent engine Step 14.5 — sentiment analysis + closing probability per message"
```

---

## Task 7: DealCard — Sentiment + Closing Badges

**Files:**
- Create: `features/boards/components/Kanban/SentimentBadge.tsx`
- Create: `features/boards/components/Kanban/ClosingBadge.tsx`
- Modify: `features/boards/components/Kanban/DealCard.tsx`

- [ ] **Step 1: Create SentimentBadge**

```tsx
// features/boards/components/Kanban/SentimentBadge.tsx
'use client'

import type { SentimentLevel } from '@/types/customer-intelligence'

const config: Record<SentimentLevel, { emoji: string; bg: string; label: string }> = {
  very_positive: { emoji: '😄', bg: 'bg-green-100 text-green-700', label: 'Muito positivo' },
  positive: { emoji: '🙂', bg: 'bg-green-50 text-green-600', label: 'Positivo' },
  neutral: { emoji: '😐', bg: 'bg-yellow-50 text-yellow-600', label: 'Neutro' },
  negative: { emoji: '😟', bg: 'bg-orange-50 text-orange-600', label: 'Negativo' },
  very_negative: { emoji: '😠', bg: 'bg-red-100 text-red-700', label: 'Muito negativo' },
}

export function SentimentBadge({ sentiment }: { sentiment?: SentimentLevel }) {
  if (!sentiment || sentiment === 'neutral') return null
  const c = config[sentiment]
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium ${c.bg}`}
      title={c.label}
    >
      {c.emoji}
    </span>
  )
}
```

- [ ] **Step 2: Create ClosingBadge**

```tsx
// features/boards/components/Kanban/ClosingBadge.tsx
'use client'

export function ClosingBadge({ probability }: { probability?: number }) {
  if (probability == null || probability === 0) return null

  const color =
    probability >= 70 ? 'bg-green-100 text-green-700' :
    probability >= 30 ? 'bg-yellow-50 text-yellow-600' :
    'bg-red-100 text-red-700'

  return (
    <span
      className={`inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium tabular-nums ${color}`}
      title={`Probabilidade de fechamento: ${probability}%`}
    >
      {probability}%
    </span>
  )
}
```

- [ ] **Step 3: Add badges to DealCard**

In `features/boards/components/Kanban/DealCard.tsx`:

Add imports at top:
```typescript
import { SentimentBadge } from './SentimentBadge'
import { ClosingBadge } from './ClosingBadge'
```

Add to `DealCardProps` interface (or extend DealView type):
```typescript
// These come from the extended DealView
```

Find the section in DealCard that renders the deal title/header area and add after it:
```tsx
{/* Sentiment + Closing badges */}
<div className="flex items-center gap-1 mt-1">
  <SentimentBadge sentiment={deal.sentiment as any} />
  <ClosingBadge probability={deal.closingProbability} />
</div>
```

Note: The `deal` object needs to include `sentiment` and `closingProbability` from the joined query. Update the deals query in `lib/supabase/deals.ts` to join with conversations if a deal has an active conversation, or simply read the `closing_probability` column directly from deals.

- [ ] **Step 4: Commit**

```bash
git add features/boards/components/Kanban/SentimentBadge.tsx features/boards/components/Kanban/ClosingBadge.tsx features/boards/components/Kanban/DealCard.tsx
git commit -m "feat: sentiment + closing probability badges on DealCard in Kanban"
```

---

## Task 8: API Routes — Customer Intelligence + Nurturing

**Files:**
- Create: `app/api/customer-intelligence/route.ts`
- Create: `app/api/customer-intelligence/[contactId]/route.ts`
- Create: `app/api/nurturing/route.ts`
- Create: `app/api/nurturing/[id]/approve/route.ts`
- Create: `app/api/nurturing/[id]/dismiss/route.ts`
- Create: `app/api/nurturing/settings/route.ts`

- [ ] **Step 1: Create customer intelligence routes**

```typescript
// app/api/customer-intelligence/route.ts
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/server'
import { customerIntelligenceService } from '@/lib/supabase/customer-intelligence'

export async function GET(request: Request) {
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const churnRisk = searchParams.get('churn_risk') ?? undefined
    const minRfm = searchParams.get('min_rfm') ? Number(searchParams.get('min_rfm')) : undefined
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 50

    const profiles = await customerIntelligenceService.listProfiles({ churn_risk: churnRisk, min_rfm: minRfm, limit })
    return NextResponse.json(profiles)
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
```

```typescript
// app/api/customer-intelligence/[contactId]/route.ts
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/server'
import { customerIntelligenceService } from '@/lib/supabase/customer-intelligence'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { contactId } = await params
    const profile = await customerIntelligenceService.getProfile(contactId)
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    return NextResponse.json(profile)
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create nurturing routes**

```typescript
// app/api/nurturing/route.ts
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/server'
import { nurturingSuggestionsService } from '@/lib/supabase/nurturing-suggestions'

export async function GET(request: Request) {
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') ?? 'pending') as any
    const urgency = searchParams.get('urgency') ?? undefined
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 50

    const suggestions = await nurturingSuggestionsService.list({ status, urgency, limit })
    return NextResponse.json(suggestions)
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
```

```typescript
// app/api/nurturing/[id]/approve/route.ts
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/server'
import { nurturingSuggestionsService } from '@/lib/supabase/nurturing-suggestions'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await nurturingSuggestionsService.approve(id)
    // TODO: In Phase 5, trigger actual message send here
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
```

```typescript
// app/api/nurturing/[id]/dismiss/route.ts
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/server'
import { nurturingSuggestionsService } from '@/lib/supabase/nurturing-suggestions'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await nurturingSuggestionsService.dismiss(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
```

```typescript
// app/api/nurturing/settings/route.ts
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    const { data: org } = await supabase
      .from('organizations')
      .select('nurturing_auto_mode, nurturing_max_auto_per_day')
      .eq('id', profile!.organization_id)
      .single()

    return NextResponse.json(org)
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    const { error } = await supabase
      .from('organizations')
      .update({
        nurturing_auto_mode: body.nurturing_auto_mode,
        nurturing_max_auto_per_day: body.nurturing_max_auto_per_day,
      })
      .eq('id', profile!.organization_id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/customer-intelligence/ app/api/nurturing/
git commit -m "feat: API routes for customer intelligence profiles + nurturing suggestions CRUD"
```

---

## Task 9: API Routes — Pipeline Triggers

**Files:**
- Create: `app/api/pipeline-triggers/route.ts`
- Create: `app/api/pipeline-triggers/[id]/route.ts`

- [ ] **Step 1: Create pipeline triggers routes**

```typescript
// app/api/pipeline-triggers/route.ts
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/server'
import { pipelineTriggersService } from '@/lib/supabase/pipeline-triggers'
import { z } from 'zod'

const createSchema = z.object({
  board_id: z.string().uuid(),
  stage_id: z.string().uuid(),
  trigger_event: z.enum(['on_enter', 'on_exit']),
  actions: z.array(z.object({
    type: z.enum(['send_email', 'send_whatsapp', 'create_activity', 'notify_team', 'add_tag']),
    config: z.record(z.unknown()),
  })),
})

export async function GET(request: Request) {
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const boardId = searchParams.get('board_id')
    if (!boardId) return NextResponse.json({ error: 'board_id required' }, { status: 400 })

    const triggers = await pipelineTriggersService.listByBoard(boardId)
    return NextResponse.json(triggers)
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = createSchema.parse(body)
    const trigger = await pipelineTriggersService.create(parsed)
    return NextResponse.json(trigger, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
```

```typescript
// app/api/pipeline-triggers/[id]/route.ts
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/server'
import { pipelineTriggersService } from '@/lib/supabase/pipeline-triggers'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    await pipelineTriggersService.update(id, body)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await pipelineTriggersService.delete(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/pipeline-triggers/
git commit -m "feat: API routes for pipeline triggers CRUD with Zod validation"
```

---

## Task 10: Edge Function — compute-contact-profiles

**Files:**
- Create: `supabase/functions/compute-contact-profiles/index.ts`

- [ ] **Step 1: Create the edge function**

```typescript
// supabase/functions/compute-contact-profiles/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  console.log('[compute-contact-profiles] Starting daily computation...')

  // Get all organizations
  const { data: orgs } = await supabase.from('organizations').select('id')
  if (!orgs?.length) return new Response('No orgs', { status: 200 })

  let totalProcessed = 0

  for (const org of orgs) {
    // Get all contacts with won deals
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('organization_id', org.id)

    if (!contacts?.length) continue

    for (const contact of contacts) {
      try {
        // Get won deals for this contact
        const { data: deals } = await supabase
          .from('deals')
          .select('value, product_name, product_category, closed_at, created_at')
          .eq('contact_id', contact.id)
          .eq('is_won', true)

        if (!deals?.length) continue

        // Calculate metrics
        const totalRevenue = deals.reduce((sum, d) => sum + (d.value || 0), 0)
        const avgTicket = totalRevenue / deals.length
        const dealsWonCount = deals.length

        // Product preferences
        const productMap = new Map<string, { count: number; last_date: string; category: string }>()
        const categoryMap = new Map<string, { count: number; revenue: number }>()

        for (const d of deals) {
          if (d.product_name) {
            const existing = productMap.get(d.product_name) || { count: 0, last_date: '', category: d.product_category || '' }
            existing.count++
            if (d.closed_at && d.closed_at > existing.last_date) existing.last_date = d.closed_at
            productMap.set(d.product_name, existing)
          }
          if (d.product_category) {
            const existing = categoryMap.get(d.product_category) || { count: 0, revenue: 0 }
            existing.count++
            existing.revenue += d.value || 0
            categoryMap.set(d.product_category, existing)
          }
        }

        const preferredProducts = Array.from(productMap.entries())
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)

        const preferredCategories = Array.from(categoryMap.entries())
          .map(([category, data]) => ({ category, ...data }))
          .sort((a, b) => b.count - a.count)

        // Peak months
        const monthMap = new Map<number, { deals_count: number; revenue: number }>()
        for (const d of deals) {
          if (d.closed_at) {
            const month = new Date(d.closed_at).getMonth() + 1
            const existing = monthMap.get(month) || { deals_count: 0, revenue: 0 }
            existing.deals_count++
            existing.revenue += d.value || 0
            monthMap.set(month, existing)
          }
        }
        const peakMonths = Array.from(monthMap.entries())
          .map(([month, data]) => ({ month, ...data }))
          .sort((a, b) => b.deals_count - a.deals_count)

        // RFM scoring
        const lastPurchaseDate = deals
          .filter(d => d.closed_at)
          .sort((a, b) => b.closed_at!.localeCompare(a.closed_at!))
          [0]?.closed_at

        const daysSinceLast = lastPurchaseDate
          ? Math.floor((Date.now() - new Date(lastPurchaseDate).getTime()) / 86400000)
          : 999

        // Recency: 1-5 (lower days = higher score)
        const rfmRecency = daysSinceLast <= 30 ? 5 : daysSinceLast <= 60 ? 4 : daysSinceLast <= 90 ? 3 : daysSinceLast <= 180 ? 2 : 1
        // Frequency: 1-5 (more deals = higher score)
        const rfmFrequency = dealsWonCount >= 10 ? 5 : dealsWonCount >= 5 ? 4 : dealsWonCount >= 3 ? 3 : dealsWonCount >= 2 ? 2 : 1
        // Monetary: 1-5 (higher total = higher score) — relative scale per org
        const rfmMonetary = totalRevenue >= 50000 ? 5 : totalRevenue >= 20000 ? 4 : totalRevenue >= 5000 ? 3 : totalRevenue >= 1000 ? 2 : 1

        // Churn risk
        const churnRisk: string =
          daysSinceLast > 180 ? 'churned' :
          daysSinceLast > 90 ? 'high' :
          daysSinceLast > 45 ? 'medium' : 'low'

        // Upsert profile
        await supabase.from('contact_behavioral_profile').upsert({
          contact_id: contact.id,
          organization_id: org.id,
          avg_ticket: avgTicket,
          total_revenue: totalRevenue,
          deals_won_count: dealsWonCount,
          preferred_products: preferredProducts,
          preferred_categories: preferredCategories,
          peak_months: peakMonths,
          rfm_recency: rfmRecency,
          rfm_frequency: rfmFrequency,
          rfm_monetary: rfmMonetary,
          churn_risk: churnRisk,
          days_since_last_purchase: daysSinceLast,
          last_purchase_date: lastPurchaseDate,
          last_computed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'contact_id' })

        totalProcessed++
      } catch (error) {
        console.error(`[compute-contact-profiles] Error for contact ${contact.id}:`, error)
      }
    }
  }

  console.log(`[compute-contact-profiles] Done. Processed ${totalProcessed} profiles.`)
  return new Response(JSON.stringify({ processed: totalProcessed }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Add pg_cron job to migration**

Append to `20260329000001_customer_intelligence.sql` or create a separate setup:

```sql
-- Schedule daily at 03:00 UTC
SELECT cron.schedule(
  'compute-contact-profiles-daily',
  '0 3 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/compute-contact-profiles',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{}'::jsonb
  )$$
);
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/compute-contact-profiles/
git commit -m "feat: Edge Function compute-contact-profiles — daily RFM, ticket, products, churn risk"
```

---

## Task 11: Nurturing Dashboard UI

**Files:**
- Create: `app/(protected)/nutricao/page.tsx`
- Create: `features/nurturing/NurturingDashboard.tsx`
- Create: `features/nurturing/components/SuggestionCard.tsx`
- Create: `features/nurturing/hooks/useNurturing.ts`
- Modify: `components/navigation/NavigationRail.tsx` (add /nutricao link)
- Modify: `components/navigation/BottomNav.tsx` (add /nutricao link)

- [ ] **Step 1: Create useNurturing hook**

```typescript
// features/nurturing/hooks/useNurturing.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/queryKeys'
import type { NurturingSuggestion, NurturingStatus } from '@/types/customer-intelligence'

export function useNurturingSuggestions(filters?: { status?: NurturingStatus; urgency?: string }) {
  return useQuery({
    queryKey: [...queryKeys.nurturing.all, filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.urgency) params.set('urgency', filters.urgency)
      const res = await fetch(`/api/nurturing?${params}`)
      if (!res.ok) throw new Error('Failed to fetch suggestions')
      return res.json() as Promise<NurturingSuggestion[]>
    },
    staleTime: 60_000,
  })
}

export function useApproveSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/nurturing/${id}/approve`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to approve')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.nurturing.all }),
  })
}

export function useDismissSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/nurturing/${id}/dismiss`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to dismiss')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.nurturing.all }),
  })
}

export function useNurturingPendingCount() {
  return useQuery({
    queryKey: [...queryKeys.nurturing.pending()],
    queryFn: async () => {
      const res = await fetch('/api/nurturing?status=pending&limit=1')
      if (!res.ok) return 0
      const data = await res.json()
      return Array.isArray(data) ? data.length : 0
    },
    staleTime: 120_000,
  })
}
```

- [ ] **Step 2: Create SuggestionCard**

```tsx
// features/nurturing/components/SuggestionCard.tsx
'use client'

import { Check, X, Clock, Send, MessageSquare, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { NurturingSuggestion } from '@/types/customer-intelligence'

const urgencyConfig = {
  critical: { label: 'Critico', variant: 'error' as const },
  high: { label: 'Alta', variant: 'warning' as const },
  medium: { label: 'Media', variant: 'default' as const },
  low: { label: 'Baixa', variant: 'info' as const },
}

const typeLabels: Record<string, string> = {
  reactivation: 'Reativacao',
  seasonal: 'Sazonal',
  upsell: 'Upsell',
  cross_sell: 'Cross-sell',
  follow_up: 'Follow-up',
  sentiment_recovery: 'Recuperacao',
}

interface SuggestionCardProps {
  suggestion: NurturingSuggestion
  onApprove: (id: string) => void
  onDismiss: (id: string) => void
  isApproving?: boolean
}

export function SuggestionCard({ suggestion, onApprove, onDismiss, isApproving }: SuggestionCardProps) {
  const urgency = urgencyConfig[suggestion.urgency]
  const ChannelIcon = suggestion.channel === 'whatsapp' ? MessageSquare : Mail

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={urgency.variant}>{urgency.label}</Badge>
            <span className="text-xs text-muted-foreground">{typeLabels[suggestion.type]}</span>
            <ChannelIcon className="h-3 w-3 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium truncate">{suggestion.contact_name}</p>
          <p className="text-sm text-muted-foreground">{suggestion.title}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground italic">{suggestion.reason}</p>

      <div className="rounded bg-muted/50 p-2 text-sm">
        {suggestion.suggested_message}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={() => onApprove(suggestion.id)}
          disabled={isApproving}
        >
          <Send className="h-3 w-3 mr-1" />
          Enviar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDismiss(suggestion.id)}
        >
          <X className="h-3 w-3 mr-1" />
          Dispensar
        </Button>
      </div>
    </Card>
  )
}
```

- [ ] **Step 3: Create NurturingDashboard**

```tsx
// features/nurturing/NurturingDashboard.tsx
'use client'

import { useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SuggestionCard } from './components/SuggestionCard'
import { useNurturingSuggestions, useApproveSuggestion, useDismissSuggestion } from './hooks/useNurturing'
import type { NurturingStatus } from '@/types/customer-intelligence'

export function NurturingDashboard() {
  const [activeTab, setActiveTab] = useState<NurturingStatus>('pending')
  const { data: suggestions = [], isLoading } = useNurturingSuggestions({ status: activeTab })
  const approve = useApproveSuggestion()
  const dismiss = useDismissSuggestion()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Lightbulb className="h-6 w-6" />
        <div>
          <h1 className="text-xl font-semibold">Nutricao Inteligente</h1>
          <p className="text-sm text-muted-foreground">Sugestoes da IA para nutrir e reativar clientes</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as NurturingStatus)}>
        <TabsList>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="approved">Aprovadas</TabsTrigger>
          <TabsTrigger value="sent">Enviadas</TabsTrigger>
          <TabsTrigger value="dismissed">Dispensadas</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma sugestao {activeTab === 'pending' ? 'pendente' : 'nesta categoria'}.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {suggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  onApprove={(id) => approve.mutate(id)}
                  onDismiss={(id) => dismiss.mutate(id)}
                  isApproving={approve.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 4: Create page**

```tsx
// app/(protected)/nutricao/page.tsx
import { NurturingDashboard } from '@/features/nurturing/NurturingDashboard'

export default function NutricaoPage() {
  return <NurturingDashboard />
}
```

- [ ] **Step 5: Add navigation link**

In `components/navigation/NavigationRail.tsx`, add to the nav items array:
```typescript
{ href: '/nutricao', icon: Lightbulb, label: 'Nutricao' },
```

In `components/navigation/BottomNav.tsx`, add the same item.

Import `Lightbulb` from `lucide-react`.

- [ ] **Step 6: Commit**

```bash
git add app/\(protected\)/nutricao/ features/nurturing/ components/navigation/NavigationRail.tsx components/navigation/BottomNav.tsx
git commit -m "feat: Nurturing Dashboard UI — suggestion cards, tabs, approve/dismiss, navigation link"
```

---

## Task 12: Campaign Segmentation by Pipeline Stage

**Files:**
- Modify: `lib/supabase/email-campaigns.ts` (add pipeline_stage segment)
- Modify: `app/api/campaigns/segment-preview/route.ts`
- Create: `features/campaigns/components/StageSegmentFilter.tsx`
- Modify: `features/campaigns/CampaignsManager.tsx`

- [ ] **Step 1: Extend SegmentFilters type**

In `lib/supabase/email-campaigns.ts`, update the `SegmentFilters` interface:

```typescript
export interface SegmentFilters {
  tags?: string[];
  lifecycle_stage?: string[];
  vertical?: string;
  has_email?: boolean;
  // New segment types
  pipeline_stage?: { board_id: string; stage_ids: string[] };
  reactivation?: { inactive_days: number };
  ready_for_proposal?: { min_probability: number };
}
```

- [ ] **Step 2: Update segment-preview API**

In `app/api/campaigns/segment-preview/route.ts`, add handling for new segment types:

```typescript
// After existing segment filters, add:
if (filters.pipeline_stage) {
  const { board_id, stage_ids } = filters.pipeline_stage
  // Get contacts from deals in these stages
  const { data: dealContacts } = await supabase
    .from('deals')
    .select('contact_id')
    .eq('board_id', board_id)
    .in('status', stage_ids)
    .eq('is_won', false)
    .eq('is_lost', false)

  if (dealContacts?.length) {
    const contactIds = dealContacts.map(d => d.contact_id)
    query = query.in('id', contactIds)
  } else {
    return NextResponse.json({ count: 0, contacts: [] })
  }
}

if (filters.reactivation) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - filters.reactivation.inactive_days)
  // Contacts with last deal before cutoff
  query = query.lt('last_purchase_date', cutoffDate.toISOString())
}

if (filters.ready_for_proposal) {
  // Contacts with deals having high closing probability
  const { data: highProbDeals } = await supabase
    .from('deals')
    .select('contact_id')
    .gte('closing_probability', filters.ready_for_proposal.min_probability)
    .eq('is_won', false)
    .eq('is_lost', false)

  if (highProbDeals?.length) {
    const contactIds = highProbDeals.map(d => d.contact_id)
    query = query.in('id', contactIds)
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/email-campaigns.ts app/api/campaigns/segment-preview/route.ts
git commit -m "feat: campaign segmentation by pipeline stage, reactivation, and closing probability"
```

---

## Task 13: Contact Intelligence Panel

**Files:**
- Create: `features/contacts/components/ContactIntelligencePanel.tsx`
- Create: `lib/query/hooks/useCustomerIntelligence.ts`

- [ ] **Step 1: Create useCustomerIntelligence hook**

```typescript
// lib/query/hooks/useCustomerIntelligence.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/queryKeys'
import type { ContactBehavioralProfile } from '@/types/customer-intelligence'

export function useContactProfile(contactId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.customerIntelligence.byContact(contactId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/customer-intelligence/${contactId}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error('Failed to fetch profile')
      return res.json() as Promise<ContactBehavioralProfile>
    },
    enabled: !!contactId,
    staleTime: 300_000,
  })
}
```

- [ ] **Step 2: Create ContactIntelligencePanel**

```tsx
// features/contacts/components/ContactIntelligencePanel.tsx
'use client'

import { TrendingUp, ShoppingBag, Calendar, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useContactProfile } from '@/lib/query/hooks/useCustomerIntelligence'

const churnColors: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  churned: 'bg-red-100 text-red-700',
  unknown: 'bg-gray-100 text-gray-500',
}

const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function ContactIntelligencePanel({ contactId }: { contactId: string }) {
  const { data: profile, isLoading } = useContactProfile(contactId)

  if (isLoading) return <p className="text-xs text-muted-foreground">Carregando perfil...</p>
  if (!profile) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <TrendingUp className="h-4 w-4" />
        Inteligencia do Cliente
      </h3>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-2">
          <p className="text-[10px] text-muted-foreground">Ticket Medio</p>
          <p className="text-sm font-semibold">R$ {profile.avg_ticket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </Card>
        <Card className="p-2">
          <p className="text-[10px] text-muted-foreground">RFM Score</p>
          <p className="text-sm font-semibold">{profile.rfm_recency + profile.rfm_frequency + profile.rfm_monetary}/15</p>
        </Card>
        <Card className="p-2">
          <p className="text-[10px] text-muted-foreground">Receita Total</p>
          <p className="text-sm font-semibold">R$ {profile.total_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </Card>
        <Card className="p-2">
          <p className="text-[10px] text-muted-foreground">Risco de Churn</p>
          <Badge className={churnColors[profile.churn_risk]}>{profile.churn_risk}</Badge>
        </Card>
      </div>

      {/* Preferred Products */}
      {profile.preferred_products.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
            <ShoppingBag className="h-3 w-3" /> Produtos Preferidos
          </p>
          <div className="flex flex-wrap gap-1">
            {profile.preferred_products.slice(0, 5).map((p) => (
              <Badge key={p.name} variant="default" className="text-[10px]">
                {p.name} ({p.count}x)
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Peak Months */}
      {profile.peak_months.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Meses de Pico
          </p>
          <div className="flex flex-wrap gap-1">
            {profile.peak_months.slice(0, 4).map((m) => (
              <Badge key={m.month} variant="info" className="text-[10px]">
                {monthNames[m.month - 1]} ({m.deals_count} deals)
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Days since last purchase */}
      {profile.days_since_last_purchase > 30 && (
        <div className="flex items-center gap-1 text-xs text-orange-500">
          <AlertTriangle className="h-3 w-3" />
          {profile.days_since_last_purchase} dias sem compra
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Integrate into contact detail view**

Find the contact detail/sidebar component (likely in `features/contacts/` or used in the Kanban deal detail panel) and add:

```tsx
import { ContactIntelligencePanel } from './ContactIntelligencePanel'

// In the component JSX, add where appropriate:
<ContactIntelligencePanel contactId={contact.id} />
```

- [ ] **Step 4: Commit**

```bash
git add lib/query/hooks/useCustomerIntelligence.ts features/contacts/components/ContactIntelligencePanel.tsx
git commit -m "feat: ContactIntelligencePanel — RFM, ticket, products, churn risk, peak months"
```

---

## Task 14: Edge Function — generate-nurturing-suggestions

**Files:**
- Create: `supabase/functions/generate-nurturing-suggestions/index.ts`

- [ ] **Step 1: Create the edge function**

```typescript
// supabase/functions/generate-nurturing-suggestions/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

async function generateMessage(prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

Deno.serve(async () => {
  console.log('[generate-nurturing-suggestions] Starting...')

  const { data: orgs } = await supabase.from('organizations').select('id, nurturing_auto_mode, nurturing_max_auto_per_day')
  if (!orgs?.length) return new Response('No orgs', { status: 200 })

  let totalGenerated = 0

  for (const org of orgs) {
    // Get profiles with risk indicators
    const { data: profiles } = await supabase
      .from('contact_behavioral_profile')
      .select('*, contacts(name, phone, email)')
      .eq('organization_id', org.id)

    if (!profiles?.length) continue

    for (const profile of profiles) {
      try {
        // Skip if already has pending suggestions
        const { count: pendingCount } = await supabase
          .from('nurturing_suggestions')
          .select('*', { count: 'exact', head: true })
          .eq('contact_id', profile.contact_id)
          .eq('status', 'pending')

        if ((pendingCount ?? 0) >= 3) continue // max 3 pending per contact

        const contactName = profile.contacts?.name ?? 'Cliente'
        const suggestions: Array<{ type: string; urgency: string; title: string; reason: string; channel: string }> = []

        // Reactivation check
        if (profile.days_since_last_purchase > 45 && profile.churn_risk !== 'churned') {
          suggestions.push({
            type: 'reactivation',
            urgency: profile.days_since_last_purchase > 90 ? 'critical' : 'high',
            title: `Reativar ${contactName} — ${profile.days_since_last_purchase} dias sem compra`,
            reason: `Cliente inativo ha ${profile.days_since_last_purchase} dias. Ticket medio: R$ ${profile.avg_ticket.toFixed(2)}. RFM decaindo.`,
            channel: 'whatsapp',
          })
        }

        // Seasonal check
        const currentMonth = new Date().getMonth() + 1
        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
        const peakSoon = (profile.peak_months as any[])?.find((m: any) => m.month === nextMonth)
        if (peakSoon) {
          suggestions.push({
            type: 'seasonal',
            urgency: 'medium',
            title: `${contactName} costuma comprar em ${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][nextMonth-1]}`,
            reason: `Historicamente, ${contactName} fez ${peakSoon.deals_count} compras em ${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][nextMonth-1]}.`,
            channel: 'whatsapp',
          })
        }

        // Sentiment recovery: check for negative sentiment in active conversations
        const { data: negConvs } = await supabase
          .from('conversations')
          .select('id, sentiment, deal_id')
          .eq('contact_id', profile.contact_id)
          .in('sentiment', ['negative', 'very_negative'])
          .in('status', ['active', 'waiting_human'])
          .limit(1)

        if (negConvs?.length) {
          suggestions.push({
            type: 'sentiment_recovery',
            urgency: 'critical',
            title: `Recuperar sentimento negativo de ${contactName}`,
            reason: `Conversa ativa com sentimento ${negConvs[0].sentiment}. Risco de perder o deal.`,
            channel: 'whatsapp',
          })
        }

        // Generate AI message for each suggestion
        for (const sug of suggestions) {
          const topProducts = (profile.preferred_products as any[])?.slice(0, 3).map((p: any) => p.name).join(', ') ?? ''
          const prompt = `Gere uma mensagem curta (max 150 chars) de WhatsApp para ${contactName}. Tipo: ${sug.type}. Contexto: ${sug.reason}. Produtos preferidos: ${topProducts}. Tom: profissional e amigavel. Sem emojis excessivos. Apenas a mensagem, sem aspas.`

          const message = await generateMessage(prompt)

          await supabase.from('nurturing_suggestions').insert({
            contact_id: profile.contact_id,
            organization_id: org.id,
            deal_id: negConvs?.[0]?.deal_id ?? null,
            type: sug.type,
            urgency: sug.urgency,
            title: sug.title,
            reason: sug.reason,
            suggested_message: message || `Ola ${contactName}, temos novidades para voce!`,
            channel: sug.channel,
            auto_send: org.nurturing_auto_mode ?? false,
          })

          totalGenerated++
        }
      } catch (error) {
        console.error(`[generate-nurturing] Error for profile ${profile.contact_id}:`, error)
      }
    }
  }

  console.log(`[generate-nurturing-suggestions] Done. Generated ${totalGenerated} suggestions.`)
  return new Response(JSON.stringify({ generated: totalGenerated }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Add pg_cron jobs**

```sql
-- Schedule 2x/day: 09:00 and 14:00 UTC
SELECT cron.schedule(
  'generate-nurturing-morning',
  '0 9 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-nurturing-suggestions',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{}'::jsonb
  )$$
);

SELECT cron.schedule(
  'generate-nurturing-afternoon',
  '0 14 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-nurturing-suggestions',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{}'::jsonb
  )$$
);
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/generate-nurturing-suggestions/
git commit -m "feat: Edge Function generate-nurturing-suggestions — reactivation, seasonal, sentiment recovery"
```

---

## Task 15: Pipeline Triggers — Execution Engine

**Files:**
- Modify: existing deal stage change webhook handler

- [ ] **Step 1: Add trigger execution to deal stage change**

Find the webhook or API that handles deal stage changes (likely in `app/api/deals/` or the webhook handler). After a deal moves to a new stage, add:

```typescript
// After deal stage change is saved:
import { pipelineTriggersService } from '@/lib/supabase/pipeline-triggers'

const triggers = await pipelineTriggersService.getActiveTriggersForStage(
  deal.boardId,
  newStageId,
  'on_enter'
)

for (const trigger of triggers) {
  for (const action of trigger.actions) {
    try {
      switch (action.type) {
        case 'notify_team': {
          // Create system notification
          await supabase.from('notifications').insert({
            organization_id: deal.organizationId,
            type: 'SYSTEM',
            title: (action.config as any).message || `Deal "${deal.title}" movido para novo stage`,
            metadata: { deal_id: deal.id, trigger_id: trigger.id },
          })
          break
        }
        case 'create_activity': {
          const config = action.config as any
          const dueDate = new Date()
          dueDate.setDate(dueDate.getDate() + (config.due_days || 1))
          await supabase.from('activities').insert({
            organization_id: deal.organizationId,
            deal_id: deal.id,
            contact_id: deal.contactId,
            type: config.activity_type || 'TASK',
            title: config.title || 'Tarefa automatica',
            due_date: dueDate.toISOString(),
            status: 'PENDING',
          })
          break
        }
        case 'add_tag': {
          const currentTags = deal.tags || []
          const newTag = (action.config as any).tag
          if (newTag && !currentTags.includes(newTag)) {
            await supabase.from('deals').update({
              tags: [...currentTags, newTag],
            }).eq('id', deal.id)
          }
          break
        }
        // send_email and send_whatsapp will be implemented in future phase
        // when Evolution API and Resend integration is complete
      }
    } catch (actionError) {
      console.error(`[PipelineTrigger] Action ${action.type} failed for trigger ${trigger.id}:`, actionError)
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/deals/
git commit -m "feat: pipeline trigger execution engine — notify, create activity, add tag on stage change"
```

---

## Summary

| Task | Description | Est. |
|---|---|---|
| 1 | Migration: customer intelligence schema | 5 min |
| 2 | Migration: nurturing + triggers schema | 5 min |
| 3 | TypeScript types | 5 min |
| 4 | Query keys + Supabase services | 10 min |
| 5 | Sentiment analysis + closing probability (AI) | 5 min |
| 6 | Agent Engine Step 14.5 | 10 min |
| 7 | DealCard badges (sentiment + closing) | 5 min |
| 8 | API routes: customer intelligence + nurturing | 10 min |
| 9 | API routes: pipeline triggers | 5 min |
| 10 | Edge Function: compute-contact-profiles | 10 min |
| 11 | Nurturing Dashboard UI | 15 min |
| 12 | Campaign segmentation by stage | 5 min |
| 13 | Contact Intelligence Panel | 10 min |
| 14 | Edge Function: generate-nurturing-suggestions | 10 min |
| 15 | Pipeline triggers execution engine | 10 min |
