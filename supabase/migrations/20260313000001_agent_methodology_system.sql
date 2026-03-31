-- ============================================================
-- Migration: Agent Methodology System + Deep Personalization
-- Date: 2026-03-13
-- Description: Sistema multi-agente com metodologias de vendas,
--              configuração por board/estágio e personalização profunda.
-- ============================================================

-- ── 1. Extend agent_configs with personalization fields ────────────

ALTER TABLE agent_configs
  ADD COLUMN IF NOT EXISTS persona jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tone_of_voice jsonb DEFAULT '{
    "preset": "profissional",
    "language_style": {
      "use_you_form": "você",
      "emoji_level": "minimal",
      "message_length": "short",
      "formality": 3
    },
    "words_to_use": [],
    "words_to_avoid": [],
    "few_shot_examples": []
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS sales_methodology jsonb DEFAULT '{
    "primary": "bant",
    "objection_library": [],
    "closing_style": "question",
    "follow_up_style": "value_based"
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS knowledge_base_config jsonb DEFAULT '{
    "sources": [],
    "search_threshold": 0.7,
    "max_results_per_query": 3,
    "always_search_before_respond": true
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS business_context_extended jsonb DEFAULT '{
    "key_products_services": [],
    "unique_value_propositions": [],
    "target_audience": {},
    "competitors": [],
    "important_rules": []
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS behavioral_training jsonb DEFAULT '{
    "do_list": [],
    "dont_list": [],
    "escalation_triggers": [],
    "conversation_starters": [],
    "success_stories": []
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS follow_up_config jsonb DEFAULT '{
    "sequences": [],
    "cac_zero_script": ""
  }'::jsonb;

-- ── 2. Agent Methodology Templates (seed data) ────────────────────

CREATE TABLE IF NOT EXISTS agent_methodology_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,           -- 'bant_sdr', 'spin_closer', 'fa_reactivation'
  display_name  text NOT NULL,           -- 'SDR — BANT + Flávio Augusto'
  description   text,
  vertical      text,                    -- NULL = generic, 'medical_clinic', etc.
  agent_role    text NOT NULL,           -- 'sdr', 'closer', 'reception', 'followup', 'cs'
  methodology   text NOT NULL,           -- 'bant', 'spin', 'meddic', 'fa', 'hybrid'
  system_prompt text NOT NULL,
  qualification_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  objection_scripts    jsonb NOT NULL DEFAULT '[]'::jsonb,
  follow_up_sequences  jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_tone_preset  text DEFAULT 'profissional',
  tags          text[] DEFAULT '{}',
  is_active     boolean DEFAULT true,
  sort_order    int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- ── 3. Per-board agent configuration ──────────────────────────────

CREATE TABLE IF NOT EXISTS agent_board_configs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  board_id                 uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  agent_mode               text NOT NULL DEFAULT 'auto', -- 'auto','template','learn','advanced'
  methodology_template_id  uuid REFERENCES agent_methodology_templates(id),
  agent_role               text NOT NULL DEFAULT 'sdr',
  system_prompt_override   text,
  personalization_override jsonb DEFAULT '{}'::jsonb,   -- overrides agent_configs fields
  is_active                boolean DEFAULT true,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now(),
  UNIQUE(organization_id, board_id)
);

-- ── 4. Per-stage agent configuration (most granular) ──────────────

CREATE TABLE IF NOT EXISTS agent_stage_configs (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  board_id               uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  stage_id               uuid NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  agent_role             text,                -- NULL = inherit from board
  system_prompt_override text,                -- NULL = inherit from board
  qualification_criteria jsonb DEFAULT '{}'::jsonb,
  auto_advance           boolean DEFAULT false,
  trigger_actions        jsonb DEFAULT '[]'::jsonb,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  UNIQUE(organization_id, stage_id)
);

-- ── 5. Agent performance metrics ──────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_performance_metrics (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             uuid NOT NULL,
  board_id                    uuid,
  stage_id                    uuid,
  period_start                date NOT NULL,
  period_end                  date NOT NULL,
  conversations_total         int DEFAULT 0,
  conversations_converted     int DEFAULT 0,
  conversion_rate             numeric(5,2) DEFAULT 0,
  avg_response_time_ms        int DEFAULT 0,
  human_escalation_rate       numeric(5,2) DEFAULT 0,
  avg_messages_to_conversion  int DEFAULT 0,
  top_objections              jsonb DEFAULT '[]'::jsonb,
  methodology_used            text,
  created_at                  timestamptz DEFAULT now()
);

-- ── 6. RLS policies ───────────────────────────────────────────────

ALTER TABLE agent_methodology_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Templates públicos são visíveis por todos"
  ON agent_methodology_templates FOR SELECT USING (is_active = true);

ALTER TABLE agent_board_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage their board configs"
  ON agent_board_configs USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

ALTER TABLE agent_stage_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage their stage configs"
  ON agent_stage_configs USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

ALTER TABLE agent_performance_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members see their metrics"
  ON agent_performance_metrics FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ── 7. Indexes ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_agent_board_configs_org_board
  ON agent_board_configs(organization_id, board_id);

CREATE INDEX IF NOT EXISTS idx_agent_stage_configs_org_stage
  ON agent_stage_configs(organization_id, stage_id);

CREATE INDEX IF NOT EXISTS idx_agent_stage_configs_board
  ON agent_stage_configs(board_id);

CREATE INDEX IF NOT EXISTS idx_agent_perf_metrics_org_period
  ON agent_performance_metrics(organization_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_agent_methodology_templates_role_vertical
  ON agent_methodology_templates(agent_role, vertical);

-- ── 8. updated_at triggers ────────────────────────────────────────

CREATE TRIGGER trg_agent_board_configs_updated_at
  BEFORE UPDATE ON agent_board_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_agent_stage_configs_updated_at
  BEFORE UPDATE ON agent_stage_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 9. Seed: Methodology Templates ───────────────────────────────

INSERT INTO agent_methodology_templates
  (name, display_name, description, vertical, agent_role, methodology, default_tone_preset, tags, sort_order, system_prompt, qualification_fields)
VALUES

-- Generic: SDR
('bant_fa_sdr', 'SDR — BANT + Flávio Augusto',
 'Qualificação de leads com BANT e abordagem proativa estilo Flávio Augusto. Alto volume, atitude e follow-up inteligente.',
 NULL, 'sdr', 'hybrid', 'profissional',
 ARRAY['generic','sdr','bant','flavio_augusto'], 10,
 'Você é {{agent_name}}, SDR da {{company_name}}. Use BANT para qualificar e a filosofia FA para abordar. Sempre entregue valor antes de pedir. Follow-up nunca é "só passando pra lembrar".',
 '[{"key":"budget","question":"Vocês têm orçamento previsto para isso?","type":"text","required":true},{"key":"authority","question":"Você toma essa decisão sozinho?","type":"boolean","required":true},{"key":"need","question":"Qual o maior desafio hoje em [área]?","type":"text","required":true},{"key":"timeline","question":"Quando precisam resolver isso?","type":"text","required":false}]'::jsonb),

-- Generic: Closer
('spin_meddic_closer', 'Closer — SPIN + MEDDIC + FA',
 'Fechamento consultivo para vendas complexas. SPIN revela e amplifica a dor. MEDDIC mapeia o processo de decisão. FA trata objeções.',
 NULL, 'closer', 'hybrid', 'consultivo',
 ARRAY['generic','closer','spin','meddic','flavio_augusto'], 20,
 'Você é {{agent_name}}, Account Executive da {{company_name}}. Conduza o lead pelo SPIN antes de propor. Mapeie o processo de decisão (MEDDIC). Use FA para objeções. Feche com clareza, não pressão.',
 '[{"key":"metrics","question":"Qual resultado mensurável você precisa em 90 dias?","type":"text","required":true},{"key":"economic_buyer","question":"Além de você, quem mais aprova?","type":"text","required":false},{"key":"pain","question":"Qual o impacto real no negócio se não resolver isso?","type":"text","required":true}]'::jsonb),

-- Generic: Reactivation
('fa_reactivation', 'Reativação — Flávio Augusto',
 'Reativação de leads frios (30d+). Cada mensagem tem um motivo real. Máximo 3 tentativas com intervalo estratégico.',
 NULL, 'followup', 'flavio_augusto', 'casual',
 ARRAY['generic','reactivation','flavio_augusto'], 30,
 'Você é {{agent_name}} da {{company_name}}. Sua missão é reativar leads que pararam de responder. NUNCA diga "só passando pra lembrar". Cada contato tem um motivo real e específico. Máximo 3 tentativas.',
 '[]'::jsonb),

-- Medical: Reception
('medical_reception', 'Recepção Clínica Médica',
 'Atendimento empático, triagem de urgências, agendamento e LGPD. Para clínicas médicas.',
 'medical_clinic', 'reception', 'consultivo', 'empático',
 ARRAY['medical','reception','lgpd','empático'], 40,
 'Você é {{agent_name}}, recepcionista virtual da {{clinic_name}}. Acolha o paciente com empatia. NUNCA diagnostique. Identifique urgências e escale imediatamente. Agende consultas respeitando disponibilidade.',
 '[{"key":"nome","question":"Qual o seu nome completo?","type":"text","required":true},{"key":"especialidade","question":"Qual especialidade ou procedimento você busca?","type":"text","required":true},{"key":"convenio","question":"Vai usar convênio? Qual?","type":"text","required":false}]'::jsonb),

-- Medical: Conversion
('fa_spin_medical_conversion', 'Conversão de Pacientes — FA + SPIN',
 'Converte leads interessados em pacientes agendados. Usa SPIN para revelar a importância do cuidado com saúde e FA para superar hesitações.',
 'medical_clinic', 'closer', 'hybrid', 'empático',
 ARRAY['medical','conversion','flavio_augusto','spin'], 50,
 'Você é {{agent_name}}, consultor de saúde da {{clinic_name}}. Ajude o lead a entender a importância de agir agora. Use SPIN para revelar o impacto da espera. Use FA para objeções. NUNCA crie alarmismo.',
 '[]'::jsonb),

-- Dental: OrthoCloser
('spin_neuro_ortho_closer', 'OrthoCloser — SPIN + Neurovendas',
 'Especialista em fechar tratamentos odontológicos de alto valor. SPIN amplifica o desejo de transformação. Neurovendas ativa gatilhos emocionais.',
 'dental_clinic', 'closer', 'hybrid', 'inspirador',
 ARRAY['dental','closer','spin','neurovendas','flavio_augusto'], 60,
 'Você é {{agent_name}}, consultor especialista em sorrisos da {{clinic_name}}. Conduza o SPIN adaptado para saúde bucal. Use gatilhos de transformação e prova social. NUNCA garanta resultados estéticos específicos.',
 '[{"key":"tratamento","question":"Qual tratamento você está considerando?","type":"text","required":true},{"key":"motivacao","question":"O que te fez buscar isso agora?","type":"text","required":true},{"key":"orcamento","question":"Você tem um valor em mente?","type":"text","required":false}]'::jsonb),

-- Real Estate: Qualification
('bant_gpct_fa_imob_qualifier', 'Qualificador Imobiliário — BANT + GPCT + FA',
 'Qualifica leads imobiliários mapeando budget, decisores, preferências e timeline. FA torna a abordagem natural e consultiva.',
 'real_estate', 'sdr', 'hybrid', 'consultivo',
 ARRAY['real_estate','qualification','bant','gpct','flavio_augusto'], 70,
 'Você é {{agent_name}}, consultor imobiliário da {{agency_name}}. Use BANT imobiliário + GPCT para mapear o perfil completo. FA torna a conversa natural. Ouça mais do que fala. Gere perfil estruturado para o PropertyMatcherAgent.',
 '[{"key":"budget_range","question":"Qual faixa de valores está considerando?","type":"text","required":true},{"key":"purpose","question":"É para moradia, investimento ou comercial?","type":"select","required":true,"options":["moradia","investimento","comercial"]},{"key":"timeline","question":"Você precisa para quando?","type":"text","required":true},{"key":"financing","question":"Vai financiar, consórcio ou à vista?","type":"select","required":false,"options":["financiamento","consórcio","à vista"]}]'::jsonb),

-- Real Estate: Negotiation
('spin_meddic_fa_negotiation', 'Negociação Imobiliária — SPIN + MEDDIC + FA',
 'Conduz a negociação pós-visita. SPIN amplifica o desejo. MEDDIC mapeia o processo de decisão. FA cria urgência legítima.',
 'real_estate', 'closer', 'hybrid', 'estratégico',
 ARRAY['real_estate','negotiation','spin','meddic','flavio_augusto'], 80,
 'Você é {{agent_name}}, especialista em negociação da {{agency_name}}. Após a visita, use SPIN para ampliar o desejo. Mapeie decisores e processo (MEDDIC). Use FA para criar urgência real e tratar objeções com respeito.',
 '[]'::jsonb);

-- ── End of migration ──────────────────────────────────────────────
