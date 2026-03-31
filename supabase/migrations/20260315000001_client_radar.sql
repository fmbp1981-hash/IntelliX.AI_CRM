-- ── Migration: Client Radar — Inteligência de Clientes ────────────────────
-- Fase: Radar de Clientes — Aniversários, VIPs, Datas Comemorativas
-- Data: 15/03/2026

-- ── 1. Adicionar campo gender na tabela contacts ───────────────────────────
ALTER TABLE public.contacts
    ADD COLUMN IF NOT EXISTS gender text
        CHECK (gender IN ('masculino', 'feminino', 'outro', 'nao_informado')),
    ADD COLUMN IF NOT EXISTS gender_inferred boolean DEFAULT false;

COMMENT ON COLUMN public.contacts.gender IS 'Gênero: masculino | feminino | outro | nao_informado';
COMMENT ON COLUMN public.contacts.gender_inferred IS 'true = inferido por IA/nome; false = informado manualmente';

-- ── 2. Tabela de regras de eventos automáticos por organização ─────────────
CREATE TABLE IF NOT EXISTS public.client_event_rules (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    event_type          text NOT NULL
        CHECK (event_type IN (
            'birthday',
            'womens_day',
            'mothers_day',
            'fathers_day',
            'valentines_day',
            'christmas',
            'new_year',
            'customer_day',
            'custom'
        )),

    is_enabled          boolean NOT NULL DEFAULT true,
    send_days_before    int NOT NULL DEFAULT 0,   -- 0 = no dia, 7 = uma semana antes
    send_time           time NOT NULL DEFAULT '09:00:00',

    -- Mensagem template (suporta variáveis {{contact.name}}, {{contact.first_name}})
    message_template    text,

    -- Quais gêneros recebem (null = todos)
    target_gender       text CHECK (target_gender IN ('masculino', 'feminino', null)),

    -- Canal: whatsapp | email | both
    channel             text NOT NULL DEFAULT 'whatsapp'
        CHECK (channel IN ('whatsapp', 'email', 'both')),

    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now(),

    UNIQUE (organization_id, event_type, send_days_before)
);

CREATE INDEX IF NOT EXISTS client_event_rules_org_idx ON public.client_event_rules (organization_id);

ALTER TABLE public.client_event_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage event rules"
    ON public.client_event_rules USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- ── 3. Log de mensagens de eventos enviadas ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_event_sends (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contact_id          uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    event_type          text NOT NULL,
    event_date          date NOT NULL,
    channel             text NOT NULL DEFAULT 'whatsapp',
    message_sent        text,
    status              text NOT NULL DEFAULT 'sent'
        CHECK (status IN ('sent', 'failed', 'skipped')),
    error_message       text,
    sent_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_event_sends_org_date_idx
    ON public.client_event_sends (organization_id, event_date DESC);
CREATE INDEX IF NOT EXISTS client_event_sends_contact_idx
    ON public.client_event_sends (contact_id, event_type, event_date DESC);

ALTER TABLE public.client_event_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view event sends"
    ON public.client_event_sends USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- ── 4. View: Clientes VIP (top por faturamento + atividade) ───────────────
CREATE OR REPLACE VIEW public.vw_vip_clients AS
SELECT
    c.id,
    c.organization_id,
    c.name,
    c.email,
    c.phone,
    c.avatar,
    c.gender,
    c.birth_date,
    c.total_value,
    c.last_interaction,
    c.last_purchase_date,
    c.stage,

    -- Contagem de deals ganhos
    COALESCE(d.won_deals_count, 0) AS won_deals_count,

    -- Faturamento total de deals ganhos
    COALESCE(d.won_deals_value, 0) AS won_deals_value,

    -- Contagem de atividades concluídas
    COALESCE(a.activities_count, 0) AS activities_count,

    -- Score VIP: (faturamento normalizado 0-100) * 0.7 + (visitas normalizado 0-100) * 0.3
    -- Calculado como score relativo (será ordenado no app)
    (COALESCE(d.won_deals_value, 0) * 0.7 + COALESCE(a.activities_count, 0) * 100 * 0.3) AS vip_score

FROM public.contacts c

LEFT JOIN (
    SELECT
        contact_id,
        COUNT(*) FILTER (WHERE status = 'WON') AS won_deals_count,
        SUM(value) FILTER (WHERE status = 'WON') AS won_deals_value
    FROM public.deals
    WHERE deleted_at IS NULL
    GROUP BY contact_id
) d ON d.contact_id = c.id

LEFT JOIN (
    SELECT
        contact_id,
        COUNT(*) AS activities_count
    FROM public.activities
    WHERE completed = true
    GROUP BY contact_id
) a ON a.contact_id = c.id

WHERE c.deleted_at IS NULL
  AND c.status = 'ACTIVE';

-- ── 5. View: Aniversários próximos (próximos 30 dias) ──────────────────────
CREATE OR REPLACE VIEW public.vw_upcoming_birthdays AS
SELECT
    c.id,
    c.organization_id,
    c.name,
    c.email,
    c.phone,
    c.avatar,
    c.gender,
    c.birth_date,
    c.stage,
    c.total_value,

    -- Dias até o próximo aniversário (considerando ano corrente ou próximo)
    CASE
        WHEN TO_CHAR(c.birth_date, 'MMDD') >= TO_CHAR(CURRENT_DATE, 'MMDD')
            THEN (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' * (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM DATE_TRUNC('year', CURRENT_DATE))) +
                 (EXTRACT(MONTH FROM c.birth_date) - 1) * INTERVAL '1 month' +
                 (EXTRACT(DAY FROM c.birth_date) - 1) * INTERVAL '1 day') - CURRENT_DATE
        ELSE
            (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' +
             (EXTRACT(MONTH FROM c.birth_date) - 1) * INTERVAL '1 month' +
             (EXTRACT(DAY FROM c.birth_date) - 1) * INTERVAL '1 day') - CURRENT_DATE
    END AS days_until_birthday,

    -- Data do próximo aniversário
    CASE
        WHEN TO_CHAR(c.birth_date, 'MMDD') >= TO_CHAR(CURRENT_DATE, 'MMDD')
            THEN DATE_TRUNC('year', CURRENT_DATE)::date
                 + (EXTRACT(MONTH FROM c.birth_date)::int - 1) * INTERVAL '1 month'
                 + (EXTRACT(DAY FROM c.birth_date)::int - 1) * INTERVAL '1 day'
        ELSE
            (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year')::date
            + (EXTRACT(MONTH FROM c.birth_date)::int - 1) * INTERVAL '1 month'
            + (EXTRACT(DAY FROM c.birth_date)::int - 1) * INTERVAL '1 day'
    END AS next_birthday_date,

    -- Qual idade vai completar
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, c.birth_date))::int + 1 AS turning_age

FROM public.contacts c
WHERE c.birth_date IS NOT NULL
  AND c.deleted_at IS NULL;

-- ── 6. Seed: Regras padrão de eventos (criadas via API no onboarding) ──────
-- Nota: As regras são criadas por org via API, não via seed global.
-- Seed apenas para referência de templates de mensagem.

-- ── 7. Trigger: updated_at em client_event_rules ──────────────────────────
CREATE OR REPLACE FUNCTION update_client_event_rules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_client_event_rules_updated_at
    BEFORE UPDATE ON public.client_event_rules
    FOR EACH ROW EXECUTE FUNCTION update_client_event_rules_updated_at();

-- ── 8. pg_cron: verificação diária de aniversários às 8h BRT (11h UTC) ────
-- Requer pg_cron habilitado no Supabase (nativo em instâncias Pro+)
DO $$
BEGIN
    -- Remove job anterior se existir
    PERFORM cron.unschedule('daily-birthday-check');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

SELECT cron.schedule(
    'daily-birthday-check',
    '0 11 * * *',
    $$
    SELECT
        net.http_post(
            url := (SELECT 'https://' || value FROM vault.secrets WHERE name = 'supabase_project_url' LIMIT 1)
                || '/functions/v1/client-events-processor',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'supabase_service_role_key' LIMIT 1)
            ),
            body := jsonb_build_object('event', 'daily_check', 'date', CURRENT_DATE::text)
        )
    $$
);
