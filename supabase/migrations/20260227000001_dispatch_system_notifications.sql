-- =============================================
-- SYSTEM NOTIFICATIONS DISPATCH + CREATION
-- =============================================
-- Data: Fevereiro 2026
-- Objetivo: Criar a tabela system_notifications e adicionar 
-- gatilhos in-app para eventos como deal.won, deal.lost, etc.

CREATE TABLE IF NOT EXISTS public.system_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('high', 'medium', 'low', 'info')),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org notifications"
    ON public.system_notifications
    FOR SELECT TO authenticated
    USING (organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update org notifications"
    ON public.system_notifications
    FOR UPDATE TO authenticated
    USING (organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ))
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert org notifications"
    ON public.system_notifications
    FOR INSERT TO authenticated
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

-- Habilita Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_notifications;


-- =============================================
-- 2. FUNÇÃO GENÉRICA DE DISPARO DE NOTIFICAÇÃO IN-APP
-- =============================================

CREATE OR REPLACE FUNCTION public.dispatch_system_notification(
    p_event_type TEXT,
    p_organization_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_link TEXT,
    p_severity TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.system_notifications (organization_id, type, title, message, link, severity)
    VALUES (p_organization_id, p_event_type, p_title, p_message, p_link, p_severity);
END;
$$;


-- =============================================
-- 3. UPDATES NOS TRIGGERS PARA INCLUIR NOTIFICAÇÕES IN-APP
-- =============================================

-- deal.created
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
  PERFORM public.dispatch_system_notification('deal_created', NEW.organization_id, 'Novo Negócio', 'O negócio ' || NEW.title || ' foi criado no board ' || COALESCE(board_name, ''), '/deals/' || NEW.id, 'info');

  RETURN NEW;
END;
$$;

-- deal.won
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
  PERFORM public.dispatch_system_notification('win_loss', NEW.organization_id, 'Negócio Ganho! \o/', 'O negócio ' || NEW.title || ' foi ganho.', '/pipeline?deal=' || NEW.id, 'high');

  RETURN NEW;
END;
$$;

-- deal.lost
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
  PERFORM public.dispatch_system_notification('win_loss', NEW.organization_id, 'Negócio Perdido', 'O negócio ' || NEW.title || ' foi perdido. Motivo: ' || COALESCE(NEW.loss_reason, 'Não informado'), '/pipeline?deal=' || NEW.id, 'medium');

  RETURN NEW;
END;
$$;

-- check_stagnant_deals
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
  endpoint_exists BOOLEAN;
BEGIN
  FOR stagnant_deal IN
    SELECT d.*
    FROM public.deals d
    WHERE d.is_won = false
      AND d.is_lost = false
      AND d.closed_at IS NULL
      AND d.updated_at < now() - INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.webhook_events_out weo
        WHERE weo.deal_id = d.id
          AND weo.event_type = 'deal.stagnant'
          AND weo.created_at > now() - INTERVAL '24 hours'
      )
  LOOP
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

    endpoint_exists := false;
    IF EXISTS (
      SELECT 1 FROM public.integration_outbound_endpoints e
      WHERE e.organization_id = stagnant_deal.organization_id
        AND e.active = true
        AND 'deal.stagnant' = ANY(e.events)
    ) THEN
        endpoint_exists := true;
    END IF;
    
    IF endpoint_exists THEN
        PERFORM public.dispatch_webhook_event('deal.stagnant', stagnant_deal.organization_id, stagnant_deal.id, payload);
    END IF;

    PERFORM public.dispatch_system_notification('stagnation', stagnant_deal.organization_id, 'Negócio Estagnado', 'O negócio (' || stagnant_deal.title || ') está estagnado há ' || stagnation_days || ' dias.', '/pipeline?deal=' || stagnant_deal.id, 'medium');
  END LOOP;
END;
$$;
