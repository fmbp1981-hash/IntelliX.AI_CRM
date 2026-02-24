-- =============================================
-- WEBHOOK EVENTS EXPANSION + PG_CRON SETUP
-- PRD Complementar — Módulo 4 + Infraestrutura
-- Data: Fevereiro 2026
-- =============================================
-- Objetivo:
--   Expandir os eventos outbound do sistema de webhooks.
--   Antes: apenas deal.stage_changed.
--   Agora: deal.created, deal.won, deal.lost, contact.created,
--          contact.stage_changed, activity.completed, deal.stagnant (via cron).
--   Reutiliza infra existente: webhook_events_out, webhook_deliveries, pg_net.
--
-- Dependências:
--   - Tabelas: integration_outbound_endpoints, webhook_events_out, webhook_deliveries
--   - Extensão: pg_net (já habilitada)
--   - Extensão: pg_cron (habilitada nesta migration)
-- =============================================

-- 1. HABILITAR PG_CRON (necessário para tarefas agendadas)
-- =============================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =============================================
-- 2. FUNÇÃO GENÉRICA DE DISPARO DE WEBHOOK
-- =============================================
-- Função utilitária para evitar duplicação de código nos triggers.
-- Recebe tipo de evento, org_id, deal_id (opcional), payload JSONB.
-- Procura endpoints ativos com o evento na lista e dispara via pg_net.

CREATE OR REPLACE FUNCTION public.dispatch_webhook_event(
  p_event_type TEXT,
  p_organization_id UUID,
  p_deal_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  endpoint RECORD;
  event_id UUID;
  delivery_id UUID;
  req_id BIGINT;
BEGIN
  FOR endpoint IN
    SELECT * FROM public.integration_outbound_endpoints e
    WHERE e.organization_id = p_organization_id
      AND e.active = true
      AND p_event_type = ANY(e.events)
  LOOP
    INSERT INTO public.webhook_events_out (organization_id, event_type, payload, deal_id)
    VALUES (p_organization_id, p_event_type, p_payload, p_deal_id)
    RETURNING id INTO event_id;

    INSERT INTO public.webhook_deliveries (organization_id, endpoint_id, event_id, status)
    VALUES (p_organization_id, endpoint.id, event_id, 'queued')
    RETURNING id INTO delivery_id;

    BEGIN
      SELECT net.http_post(
        url := endpoint.url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Webhook-Secret', endpoint.secret,
          'Authorization', ('Bearer ' || endpoint.secret)
        ),
        body := p_payload
      ) INTO req_id;

      UPDATE public.webhook_deliveries
        SET request_id = req_id
      WHERE id = delivery_id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.webhook_deliveries
        SET status = 'failed',
            error = SQLERRM
      WHERE id = delivery_id;
    END;
  END LOOP;
END;
$$;

-- =============================================
-- 3. TRIGGER: deal.created
-- =============================================
-- Dispara quando um novo deal é inserido.

CREATE OR REPLACE FUNCTION public.notify_deal_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  board_name TEXT;
  stage_label TEXT;
  contact_name TEXT;
  contact_phone TEXT;
  contact_email TEXT;
  payload JSONB;
BEGIN
  SELECT b.name INTO board_name FROM public.boards b WHERE b.id = NEW.board_id;
  SELECT bs.label INTO stage_label FROM public.board_stages bs WHERE bs.id = NEW.stage_id;

  IF NEW.contact_id IS NOT NULL THEN
    SELECT c.name, c.phone, c.email
      INTO contact_name, contact_phone, contact_email
    FROM public.contacts c WHERE c.id = NEW.contact_id;
  END IF;

  payload := jsonb_build_object(
    'event_type', 'deal.created',
    'occurred_at', now(),
    'deal', jsonb_build_object(
      'id', NEW.id,
      'title', NEW.title,
      'value', NEW.value,
      'board_id', NEW.board_id,
      'board_name', board_name,
      'stage_id', NEW.stage_id,
      'stage_label', stage_label,
      'contact_id', NEW.contact_id,
      'source', COALESCE(NEW.custom_fields->>'creation_source', 'manual')
    ),
    'contact', jsonb_build_object(
      'name', contact_name,
      'phone', contact_phone,
      'email', contact_email
    )
  );

  PERFORM public.dispatch_webhook_event('deal.created', NEW.organization_id, NEW.id, payload);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_deal_created ON public.deals;
CREATE TRIGGER trg_notify_deal_created
AFTER INSERT ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.notify_deal_created();

-- =============================================
-- 4. TRIGGER: deal.won
-- =============================================
-- Dispara quando is_won muda de false para true.

CREATE OR REPLACE FUNCTION public.notify_deal_won()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  board_name TEXT;
  contact_name TEXT;
  contact_phone TEXT;
  contact_email TEXT;
  days_to_close INT;
  payload JSONB;
BEGIN
  IF NOT (NEW.is_won = true AND (OLD.is_won IS DISTINCT FROM true)) THEN
    RETURN NEW;
  END IF;

  SELECT b.name INTO board_name FROM public.boards b WHERE b.id = NEW.board_id;

  IF NEW.contact_id IS NOT NULL THEN
    SELECT c.name, c.phone, c.email
      INTO contact_name, contact_phone, contact_email
    FROM public.contacts c WHERE c.id = NEW.contact_id;
  END IF;

  days_to_close := EXTRACT(DAY FROM (COALESCE(NEW.closed_at, now()) - NEW.created_at))::INT;

  payload := jsonb_build_object(
    'event_type', 'deal.won',
    'occurred_at', now(),
    'deal', jsonb_build_object(
      'id', NEW.id,
      'title', NEW.title,
      'value', NEW.value,
      'board_id', NEW.board_id,
      'board_name', board_name,
      'won_value', NEW.value,
      'days_to_close', days_to_close,
      'contact_id', NEW.contact_id
    ),
    'contact', jsonb_build_object(
      'name', contact_name,
      'phone', contact_phone,
      'email', contact_email
    )
  );

  PERFORM public.dispatch_webhook_event('deal.won', NEW.organization_id, NEW.id, payload);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_deal_won ON public.deals;
CREATE TRIGGER trg_notify_deal_won
AFTER UPDATE ON public.deals
FOR EACH ROW
WHEN (NEW.is_won = true AND OLD.is_won IS DISTINCT FROM true)
EXECUTE FUNCTION public.notify_deal_won();

-- =============================================
-- 5. TRIGGER: deal.lost
-- =============================================
-- Dispara quando is_lost muda de false para true.

CREATE OR REPLACE FUNCTION public.notify_deal_lost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  board_name TEXT;
  contact_name TEXT;
  contact_phone TEXT;
  contact_email TEXT;
  days_in_pipeline INT;
  payload JSONB;
BEGIN
  IF NOT (NEW.is_lost = true AND (OLD.is_lost IS DISTINCT FROM true)) THEN
    RETURN NEW;
  END IF;

  SELECT b.name INTO board_name FROM public.boards b WHERE b.id = NEW.board_id;

  IF NEW.contact_id IS NOT NULL THEN
    SELECT c.name, c.phone, c.email
      INTO contact_name, contact_phone, contact_email
    FROM public.contacts c WHERE c.id = NEW.contact_id;
  END IF;

  days_in_pipeline := EXTRACT(DAY FROM (COALESCE(NEW.closed_at, now()) - NEW.created_at))::INT;

  payload := jsonb_build_object(
    'event_type', 'deal.lost',
    'occurred_at', now(),
    'deal', jsonb_build_object(
      'id', NEW.id,
      'title', NEW.title,
      'value', NEW.value,
      'board_id', NEW.board_id,
      'board_name', board_name,
      'loss_reason', NEW.loss_reason,
      'days_in_pipeline', days_in_pipeline,
      'contact_id', NEW.contact_id
    ),
    'contact', jsonb_build_object(
      'name', contact_name,
      'phone', contact_phone,
      'email', contact_email
    )
  );

  PERFORM public.dispatch_webhook_event('deal.lost', NEW.organization_id, NEW.id, payload);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_deal_lost ON public.deals;
CREATE TRIGGER trg_notify_deal_lost
AFTER UPDATE ON public.deals
FOR EACH ROW
WHEN (NEW.is_lost = true AND OLD.is_lost IS DISTINCT FROM true)
EXECUTE FUNCTION public.notify_deal_lost();

-- =============================================
-- 6. TRIGGER: contact.created
-- =============================================

CREATE OR REPLACE FUNCTION public.notify_contact_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stage_name TEXT;
  payload JSONB;
BEGIN
  IF NEW.lifecycle_stage IS NOT NULL THEN
    SELECT ls.name INTO stage_name
    FROM public.lifecycle_stages ls WHERE ls.id = NEW.lifecycle_stage;
  END IF;

  payload := jsonb_build_object(
    'event_type', 'contact.created',
    'occurred_at', now(),
    'contact', jsonb_build_object(
      'id', NEW.id,
      'name', NEW.name,
      'email', NEW.email,
      'phone', NEW.phone,
      'lifecycle_stage', stage_name,
      'source', COALESCE(NEW.source, 'manual')
    )
  );

  PERFORM public.dispatch_webhook_event('contact.created', NEW.organization_id, NULL, payload);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_contact_created ON public.contacts;
CREATE TRIGGER trg_notify_contact_created
AFTER INSERT ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.notify_contact_created();

-- =============================================
-- 7. TRIGGER: contact.stage_changed
-- =============================================

CREATE OR REPLACE FUNCTION public.notify_contact_stage_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  from_stage TEXT;
  to_stage TEXT;
  payload JSONB;
BEGIN
  IF NEW.lifecycle_stage IS NOT DISTINCT FROM OLD.lifecycle_stage THEN
    RETURN NEW;
  END IF;

  IF OLD.lifecycle_stage IS NOT NULL THEN
    SELECT ls.name INTO from_stage FROM public.lifecycle_stages ls WHERE ls.id = OLD.lifecycle_stage;
  END IF;
  IF NEW.lifecycle_stage IS NOT NULL THEN
    SELECT ls.name INTO to_stage FROM public.lifecycle_stages ls WHERE ls.id = NEW.lifecycle_stage;
  END IF;

  payload := jsonb_build_object(
    'event_type', 'contact.stage_changed',
    'occurred_at', now(),
    'contact', jsonb_build_object(
      'id', NEW.id,
      'name', NEW.name,
      'email', NEW.email,
      'phone', NEW.phone,
      'from_stage', from_stage,
      'to_stage', to_stage
    )
  );

  PERFORM public.dispatch_webhook_event('contact.stage_changed', NEW.organization_id, NULL, payload);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_contact_stage_changed ON public.contacts;
CREATE TRIGGER trg_notify_contact_stage_changed
AFTER UPDATE ON public.contacts
FOR EACH ROW
WHEN (NEW.lifecycle_stage IS DISTINCT FROM OLD.lifecycle_stage)
EXECUTE FUNCTION public.notify_contact_stage_changed();

-- =============================================
-- 8. TRIGGER: activity.completed
-- =============================================

CREATE OR REPLACE FUNCTION public.notify_activity_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deal_org_id UUID;
  payload JSONB;
BEGIN
  IF NOT (NEW.completed = true AND (OLD.completed IS DISTINCT FROM true)) THEN
    RETURN NEW;
  END IF;

  -- activities don't have org_id directly, get via deal
  IF NEW.deal_id IS NOT NULL THEN
    SELECT d.organization_id INTO deal_org_id
    FROM public.deals d WHERE d.id = NEW.deal_id;
  END IF;

  IF deal_org_id IS NULL THEN
    RETURN NEW; -- no org, skip
  END IF;

  payload := jsonb_build_object(
    'event_type', 'activity.completed',
    'occurred_at', now(),
    'activity', jsonb_build_object(
      'id', NEW.id,
      'type', NEW.type,
      'title', NEW.title,
      'deal_id', NEW.deal_id,
      'contact_id', NEW.contact_id,
      'completed_at', COALESCE(NEW.completed_at, now())
    )
  );

  PERFORM public.dispatch_webhook_event('activity.completed', deal_org_id, NEW.deal_id, payload);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_activity_completed ON public.activities;
CREATE TRIGGER trg_notify_activity_completed
AFTER UPDATE ON public.activities
FOR EACH ROW
WHEN (NEW.completed = true AND OLD.completed IS DISTINCT FROM true)
EXECUTE FUNCTION public.notify_activity_completed();

-- =============================================
-- 9. FUNÇÃO + CRON: deal.stagnant
-- =============================================
-- Roda a cada hora. Detecta deals abertos sem atividade recente.
-- Usa a tabela notification_preferences para saber o threshold por org.
-- Default: 7 dias sem atividade nem mudança de stage.

CREATE OR REPLACE FUNCTION public.check_stagnant_deals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stagnant_deal RECORD;
  last_activity TIMESTAMPTZ;
  stagnation_days INT;
  payload JSONB;
  board_name TEXT;
  stage_label TEXT;
  contact_name TEXT;
BEGIN
  FOR stagnant_deal IN
    SELECT d.*
    FROM public.deals d
    WHERE d.is_won = false
      AND d.is_lost = false
      AND d.closed_at IS NULL
      -- Sem update há pelo menos 7 dias
      AND d.updated_at < now() - INTERVAL '7 days'
      -- Não disparou evento stagnant nas últimas 24h (evita spam)
      AND NOT EXISTS (
        SELECT 1 FROM public.webhook_events_out weo
        WHERE weo.deal_id = d.id
          AND weo.event_type = 'deal.stagnant'
          AND weo.created_at > now() - INTERVAL '24 hours'
      )
  LOOP
    -- Verificar se existe endpoint ativo para o evento
    IF NOT EXISTS (
      SELECT 1 FROM public.integration_outbound_endpoints e
      WHERE e.organization_id = stagnant_deal.organization_id
        AND e.active = true
        AND 'deal.stagnant' = ANY(e.events)
    ) THEN
      CONTINUE;
    END IF;

    -- Buscar última atividade do deal
    SELECT MAX(a.created_at) INTO last_activity
    FROM public.activities a WHERE a.deal_id = stagnant_deal.id;

    stagnation_days := EXTRACT(DAY FROM (now() - GREATEST(
      stagnant_deal.updated_at,
      COALESCE(last_activity, stagnant_deal.created_at)
    )))::INT;

    SELECT b.name INTO board_name FROM public.boards b WHERE b.id = stagnant_deal.board_id;
    SELECT bs.label INTO stage_label FROM public.board_stages bs WHERE bs.id = stagnant_deal.stage_id;

    IF stagnant_deal.contact_id IS NOT NULL THEN
      SELECT c.name INTO contact_name FROM public.contacts c WHERE c.id = stagnant_deal.contact_id;
    END IF;

    payload := jsonb_build_object(
      'event_type', 'deal.stagnant',
      'occurred_at', now(),
      'deal', jsonb_build_object(
        'id', stagnant_deal.id,
        'title', stagnant_deal.title,
        'value', stagnant_deal.value,
        'board_id', stagnant_deal.board_id,
        'board_name', board_name,
        'stage_id', stagnant_deal.stage_id,
        'stage_label', stage_label,
        'stagnation_days', stagnation_days,
        'last_activity', last_activity,
        'contact_id', stagnant_deal.contact_id,
        'contact_name', contact_name
      )
    );

    PERFORM public.dispatch_webhook_event('deal.stagnant', stagnant_deal.organization_id, stagnant_deal.id, payload);
  END LOOP;
END;
$$;

-- Cron: rodar verificação de estagnação a cada hora
SELECT cron.schedule(
  'check-stagnant-deals',
  '0 * * * *',  -- a cada hora cheia
  $$SELECT public.check_stagnant_deals()$$
);

-- =============================================
-- 10. CRON: Reset mensal de quotas de IA
-- =============================================
-- Roda diariamente à 00:05, reseta orgs cujo reset_day == dia atual

SELECT cron.schedule(
  'reset-ai-quotas-monthly',
  '5 0 * * *',  -- todo dia às 00:05 UTC
  $$SELECT public.reset_monthly_ai_quotas()$$
);

-- =============================================
-- 11. GRANTS
-- =============================================
GRANT EXECUTE ON FUNCTION public.dispatch_webhook_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_stagnant_deals TO authenticated;
