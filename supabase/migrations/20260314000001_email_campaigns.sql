-- ============================================================
-- Migration: Email Campaigns Module
-- Date: 2026-03-14
-- Description: Tabelas para campanhas de email segmentadas,
--              templates de email e tracking de envios.
-- ============================================================

-- ── Enum: Status de Campanha ──────────────────────────────
CREATE TYPE campaign_status AS ENUM (
    'draft',
    'scheduled',
    'sending',
    'sent',
    'paused',
    'cancelled'
);

-- ── Tabela: email_templates ───────────────────────────────
CREATE TABLE IF NOT EXISTS email_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    subject             TEXT NOT NULL,
    html_body           TEXT NOT NULL,
    text_body           TEXT,
    preview_text        TEXT,
    ai_generated        BOOLEAN NOT NULL DEFAULT FALSE,
    created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela: email_campaigns ───────────────────────────────
CREATE TABLE IF NOT EXISTS email_campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    status              campaign_status NOT NULL DEFAULT 'draft',
    template_id         UUID REFERENCES email_templates(id) ON DELETE SET NULL,

    -- Segmentação: filtros como JSONB para flexibilidade
    -- Ex: { "tags": ["cliente-vip"], "lifecycle_stage": ["LEAD"], "vertical": "real_estate" }
    segment_filters     JSONB NOT NULL DEFAULT '{}',
    estimated_recipients INT NOT NULL DEFAULT 0,

    -- Agendamento
    scheduled_at        TIMESTAMPTZ,
    sent_at             TIMESTAMPTZ,

    -- Métricas agregadas (atualizadas via triggers/webhook Resend)
    total_sent          INT NOT NULL DEFAULT 0,
    total_delivered     INT NOT NULL DEFAULT 0,
    total_opened        INT NOT NULL DEFAULT 0,
    total_clicked       INT NOT NULL DEFAULT 0,
    total_bounced       INT NOT NULL DEFAULT 0,
    total_unsubscribed  INT NOT NULL DEFAULT 0,

    created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela: email_campaign_sends ──────────────────────────
-- Registro individual por contato × campanha
CREATE TABLE IF NOT EXISTS email_campaign_sends (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
    contact_id          UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    email               TEXT NOT NULL,
    resend_message_id   TEXT,                 -- ID retornado pelo Resend para tracking
    status              TEXT NOT NULL DEFAULT 'pending',
                        -- pending | sent | delivered | opened | clicked | bounced | unsubscribed | failed
    sent_at             TIMESTAMPTZ,
    opened_at           TIMESTAMPTZ,
    clicked_at          TIMESTAMPTZ,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela: email_unsubscribes ────────────────────────────
-- Descadastramentos globais por org (nunca reenviar para este email)
CREATE TABLE IF NOT EXISTS email_unsubscribes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email               TEXT NOT NULL,
    reason              TEXT,
    campaign_id         UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
    unsubscribed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, email)
);

-- ── Row Level Security ────────────────────────────────────
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- email_templates: acesso por organization_id do profile
CREATE POLICY "email_templates_org_policy" ON email_templates
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- email_campaigns: idem
CREATE POLICY "email_campaigns_org_policy" ON email_campaigns
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- email_campaign_sends: via campanha da org
CREATE POLICY "email_campaign_sends_org_policy" ON email_campaign_sends
    USING (
        campaign_id IN (
            SELECT ec.id FROM email_campaigns ec
            JOIN profiles p ON p.organization_id = ec.organization_id
            WHERE p.id = auth.uid()
        )
    );

-- email_unsubscribes: por org do profile
CREATE POLICY "email_unsubscribes_org_policy" ON email_unsubscribes
    USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- ── Triggers updated_at ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_email_campaigns_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_email_campaigns_updated_at();

CREATE TRIGGER email_campaigns_updated_at
    BEFORE UPDATE ON email_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_email_campaigns_updated_at();

-- ── Índices ───────────────────────────────────────────────
CREATE INDEX idx_email_templates_org     ON email_templates(organization_id);
CREATE INDEX idx_email_campaigns_org     ON email_campaigns(organization_id);
CREATE INDEX idx_email_campaigns_status  ON email_campaigns(status);
CREATE INDEX idx_email_campaigns_sched   ON email_campaigns(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX idx_campaign_sends_campaign ON email_campaign_sends(campaign_id);
CREATE INDEX idx_campaign_sends_contact  ON email_campaign_sends(contact_id);
CREATE INDEX idx_campaign_sends_status   ON email_campaign_sends(status);
CREATE INDEX idx_unsubscribes_email      ON email_unsubscribes(organization_id, email);
