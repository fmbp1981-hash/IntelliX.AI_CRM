-- =============================================
-- Follow-up Sequences & Vertical Journeys
-- Migration: followup_sequences_and_journeys
-- Date: 2026-03-03
-- =============================================
-- Implements PRD Addendum: Follow-ups, Nurturing & Jornada do Cliente
-- Creates tables for proactive follow-up sequences, execution tracking,
-- appointment reminders (clinics), and property journey (real estate).

-- =============================================
-- 1. FOLLOWUP SEQUENCES
-- Configurable follow-up sequences per type and vertical
-- =============================================
CREATE TABLE IF NOT EXISTS public.followup_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    sequence_type TEXT NOT NULL CHECK (sequence_type IN ('quick', 'warm', 'pipeline', 'remarketing', 'reactivation')),
    vertical_type TEXT NOT NULL DEFAULT 'generic' CHECK (vertical_type IN ('generic', 'medical_clinic', 'dental_clinic', 'real_estate')),

    is_active BOOLEAN NOT NULL DEFAULT true,
    steps JSONB NOT NULL DEFAULT '[]',
    -- Array of steps: [{ step_number, delay_minutes, message_type, message_prompt, condition?, channel, fallback_to_template, create_inbox_item, max_retry }]

    trigger_condition JSONB NOT NULL DEFAULT '{}',
    -- { type: "conversation_idle", idle_minutes: 30 }
    -- { type: "deal_stagnant", stage_name: "...", stagnant_days: 3 }
    -- { type: "contact_inactive", inactive_months: 6 }

    stop_conditions JSONB NOT NULL DEFAULT '["lead_replied", "deal_won", "deal_lost", "unsubscribed"]',

    max_messages_per_day INT NOT NULL DEFAULT 2,
    respect_business_hours BOOLEAN NOT NULL DEFAULT true,
    min_hours_between_messages INT NOT NULL DEFAULT 4,

    respect_24h_window BOOLEAN NOT NULL DEFAULT true,
    template_message_id TEXT,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.followup_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "followup_sequences_tenant_isolation" ON public.followup_sequences
    FOR ALL
    USING (organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ))
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "followup_sequences_service_role" ON public.followup_sequences
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_fs_org_type ON public.followup_sequences(organization_id, sequence_type);
CREATE INDEX IF NOT EXISTS idx_fs_org_vertical ON public.followup_sequences(organization_id, vertical_type);

-- =============================================
-- 2. FOLLOWUP EXECUTIONS
-- Tracks each execution of a follow-up sequence per conversation/deal
-- =============================================
CREATE TABLE IF NOT EXISTS public.followup_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES public.followup_sequences(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,

    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled', 'stopped_by_reply')),
    current_step INT NOT NULL DEFAULT 0,

    messages_sent INT NOT NULL DEFAULT 0,
    last_sent_at TIMESTAMPTZ,
    next_scheduled_at TIMESTAMPTZ,

    result TEXT CHECK (result IN ('lead_replied', 'converted', 'unsubscribed', 'max_attempts', 'manual_stop')),
    result_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.followup_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "followup_executions_tenant_isolation" ON public.followup_executions
    FOR ALL
    USING (organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ))
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "followup_executions_service_role" ON public.followup_executions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_fe_next_scheduled ON public.followup_executions(next_scheduled_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_fe_conversation ON public.followup_executions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_fe_org_status ON public.followup_executions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_fe_deal ON public.followup_executions(deal_id);

-- =============================================
-- 3. APPOINTMENT REMINDERS (Clinics)
-- Full patient journey: scheduling → prep → reminders → post-care → satisfaction → return
-- =============================================
CREATE TABLE IF NOT EXISTS public.appointment_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,

    appointment_datetime TIMESTAMPTZ NOT NULL,
    appointment_type TEXT NOT NULL CHECK (appointment_type IN ('consulta', 'exame', 'cirurgia', 'retorno', 'avaliacao', 'manutencao')),
    professional_name TEXT,
    location_info TEXT,

    preparation_instructions JSONB DEFAULT '[]',
    required_documents JSONB DEFAULT '[]',

    reminders_config JSONB NOT NULL DEFAULT '[
        { "type": "7d", "days_before": 7, "sent": false, "sent_at": null },
        { "type": "2d", "days_before": 2, "sent": false, "sent_at": null },
        { "type": "1d", "days_before": 1, "sent": false, "sent_at": null },
        { "type": "1h", "days_before": 0, "hours_before": 1, "sent": false, "sent_at": null },
        { "type": "day", "days_before": 0, "hours_before": 3, "sent": false, "sent_at": null }
    ]',

    confirmed BOOLEAN DEFAULT false,
    confirmed_at TIMESTAMPTZ,
    cancelled BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    rescheduled_to TIMESTAMPTZ,

    attended BOOLEAN,
    satisfaction_survey_sent BOOLEAN DEFAULT false,
    satisfaction_survey_sent_at TIMESTAMPTZ,
    satisfaction_score INT CHECK (satisfaction_score IS NULL OR (satisfaction_score >= 1 AND satisfaction_score <= 5)),
    satisfaction_feedback TEXT,
    post_care_instructions_sent BOOLEAN DEFAULT false,

    return_recommended BOOLEAN DEFAULT false,
    return_date TIMESTAMPTZ,
    return_reminder_sent BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointment_reminders_tenant_isolation" ON public.appointment_reminders
    FOR ALL
    USING (organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ))
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "appointment_reminders_service_role" ON public.appointment_reminders
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ar_upcoming ON public.appointment_reminders(appointment_datetime)
    WHERE attended IS NULL AND cancelled = false;
CREATE INDEX IF NOT EXISTS idx_ar_org ON public.appointment_reminders(organization_id, appointment_datetime);
CREATE INDEX IF NOT EXISTS idx_ar_contact ON public.appointment_reminders(contact_id);

-- =============================================
-- 4. PROPERTY JOURNEY (Real Estate)
-- Full client journey: match → visit → feedback → proposal → documentation
-- =============================================
CREATE TABLE IF NOT EXISTS public.property_journey (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,

    property_id UUID,

    visit_datetime TIMESTAMPTZ,
    visit_type TEXT CHECK (visit_type IS NULL OR visit_type IN ('presencial', 'virtual', 'video_call')),

    visit_reminders_config JSONB NOT NULL DEFAULT '[
        { "type": "2d", "days_before": 2, "sent": false, "sent_at": null },
        { "type": "1d", "days_before": 1, "sent": false, "sent_at": null },
        { "type": "day", "hours_before": 2, "sent": false, "sent_at": null }
    ]',

    pre_visit_info_sent BOOLEAN DEFAULT false,
    property_highlights JSONB DEFAULT '[]',
    neighborhood_info JSONB DEFAULT '{}',
    route_info TEXT,

    confirmed BOOLEAN DEFAULT false,
    confirmed_at TIMESTAMPTZ,
    cancelled BOOLEAN DEFAULT false,
    rescheduled_to TIMESTAMPTZ,

    visit_completed BOOLEAN DEFAULT false,
    feedback_collected BOOLEAN DEFAULT false,
    feedback_score INT CHECK (feedback_score IS NULL OR (feedback_score >= 1 AND feedback_score <= 5)),
    feedback_text TEXT,
    feedback_objections JSONB DEFAULT '[]',

    alternative_properties_sent BOOLEAN DEFAULT false,
    alternatives_sent_at TIMESTAMPTZ,

    proposal_sent BOOLEAN DEFAULT false,
    proposal_value DECIMAL(12,2),
    proposal_sent_at TIMESTAMPTZ,
    proposal_followup_count INT DEFAULT 0,

    documentation_checklist JSONB DEFAULT '[]',
    documentation_reminder_sent BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.property_journey ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_journey_tenant_isolation" ON public.property_journey
    FOR ALL
    USING (organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ))
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "property_journey_service_role" ON public.property_journey
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pj_upcoming ON public.property_journey(visit_datetime)
    WHERE visit_completed = false AND cancelled = false;
CREATE INDEX IF NOT EXISTS idx_pj_org ON public.property_journey(organization_id);
CREATE INDEX IF NOT EXISTS idx_pj_contact ON public.property_journey(contact_id);

-- =============================================
-- 5. CRON JOB for processing follow-ups
-- =============================================
-- NOTE: Actual cron job must be created in Supabase Dashboard with project URL:
/*
SELECT cron.schedule(
    'process-followups-5min',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url:='https://[PROJECT-REF].supabase.co/functions/v1/process-followups',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer [SERVICE-ROLE-KEY]"}'::jsonb,
        body:='{}'::jsonb
    );
    $$
);
*/
