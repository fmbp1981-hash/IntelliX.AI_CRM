-- =============================================================================
-- Migration: Seed Vertical Configs
-- Date: 2026-02-24
-- Description: Populates vertical_configs with the 4 business types:
--   generic, medical_clinic, dental_clinic, real_estate
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. GENERIC (default)
-- ---------------------------------------------------------------------------
INSERT INTO vertical_configs (business_type, display_config, custom_fields_schema, default_pipeline_template, default_automations, ai_context, dashboard_widgets, inbox_rules, feature_flags)
VALUES (
  'generic',
  '{
    "deal_label": "Deal",
    "deal_label_plural": "Deals",
    "contact_label": "Contato",
    "contact_label_plural": "Contatos",
    "pipeline_label": "Pipeline",
    "activity_label": "Atividade",
    "company_label": "Empresa",
    "won_label": "Ganho",
    "lost_label": "Perdido"
  }'::jsonb,
  '{"contact": [], "deal": []}'::jsonb,
  '[]'::jsonb,
  '{}'::jsonb,
  '{
    "system_prompt_vertical": "Você é o assistente de CRM genérico para equipes de vendas B2B. Foco em produtividade, conversão de pipeline e organização de atividades.",
    "action_prompts": {},
    "priority_weights": {
      "financial_value": 0.30,
      "idle_days": 0.30,
      "ai_probability": 0.20,
      "temporal_urgency": 0.10,
      "recurrence_retention": 0.10
    }
  }'::jsonb,
  '[]'::jsonb,
  '{}'::jsonb,
  '{
    "pipeline_kanban": true,
    "contacts_management": true,
    "inbox_intelligent": true,
    "ai_central": true,
    "custom_fields": true,
    "scheduling_calendar": false,
    "absenteeism_tracking": false,
    "insurance_management": false,
    "budget_pipeline": false,
    "installment_tracking": false,
    "treatment_progress": false,
    "maintenance_recurrence": false,
    "property_management": false,
    "client_property_match": false,
    "visit_management": false,
    "commission_tracking": false,
    "broker_view": false
  }'::jsonb
)
ON CONFLICT (business_type) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. MEDICAL CLINIC
-- ---------------------------------------------------------------------------
INSERT INTO vertical_configs (business_type, display_config, custom_fields_schema, default_pipeline_template, default_automations, ai_context, dashboard_widgets, inbox_rules, feature_flags)
VALUES (
  'medical_clinic',
  '{
    "deal_label": "Atendimento",
    "deal_label_plural": "Atendimentos",
    "contact_label": "Paciente",
    "contact_label_plural": "Pacientes",
    "pipeline_label": "Jornada do Paciente",
    "activity_label": "Interação",
    "company_label": "Clínica / Unidade",
    "won_label": "Concluído",
    "lost_label": "Cancelado"
  }'::jsonb,
  '{
    "contact": [
      {"key": "convenio", "label": "Convênio", "type": "select", "options_configurable": true, "required": false},
      {"key": "carteirinha_convenio", "label": "Nº Carteirinha", "type": "text", "required": false},
      {"key": "medico_responsavel", "label": "Médico Responsável", "type": "select", "source": "team_members", "required": true},
      {"key": "especialidade", "label": "Especialidade", "type": "select", "options": ["Clínica Geral", "Cardiologia", "Dermatologia", "Ginecologia", "Oftalmologia", "Ortopedia", "Pediatria", "Outro"], "required": true},
      {"key": "ultima_consulta", "label": "Última Consulta", "type": "date", "auto_fill": true},
      {"key": "proximo_retorno", "label": "Próximo Retorno", "type": "date", "required": false},
      {"key": "status_clinico", "label": "Status Clínico", "type": "select", "options": ["Ativo", "Inativo", "Alta"], "auto_fill": true},
      {"key": "alergias", "label": "Alergias", "type": "text", "required": false},
      {"key": "observacoes_lgpd", "label": "Observações (LGPD)", "type": "textarea", "encrypted": true, "required": false}
    ],
    "deal": [
      {"key": "tipo_procedimento", "label": "Tipo de Procedimento", "type": "select", "options": ["Consulta", "Exame", "Cirurgia", "Retorno"], "required": true},
      {"key": "valor_estimado", "label": "Valor Estimado", "type": "currency", "currency": "BRL", "required": false},
      {"key": "autorizacao_convenio", "label": "Autorização Convênio", "type": "select", "options": ["Pendente", "Autorizado", "Negado", "Particular"], "required": false},
      {"key": "status_agendamento", "label": "Status Agendamento", "type": "select", "options": ["Agendado", "Confirmado", "Em Espera", "Cancelado"], "required": true},
      {"key": "compareceu", "label": "Compareceu?", "type": "boolean", "required": false},
      {"key": "retorno_necessario", "label": "Retorno Necessário?", "type": "boolean", "required": false},
      {"key": "data_agendamento", "label": "Data do Agendamento", "type": "datetime", "required": true}
    ]
  }'::jsonb,
  '[
    {"order": 1, "name": "Primeiro Contato", "color": "#3B82F6", "automation": "ai_welcome_template"},
    {"order": 2, "name": "Agendamento", "color": "#8B5CF6", "automation": "reminder_24h"},
    {"order": 3, "name": "Confirmação", "color": "#F59E0B", "automation": "whatsapp_confirmation"},
    {"order": 4, "name": "Em Atendimento", "color": "#10B981", "automation": "duration_timer"},
    {"order": 5, "name": "Pós-Consulta", "color": "#6366F1", "automation": "ai_followup_satisfaction"},
    {"order": 6, "name": "Retorno Agendado", "color": "#EC4899", "automation": "reminder_return"},
    {"order": 7, "name": "Alta / Concluído", "color": "#22C55E", "automation": "reactivation_6months"}
  ]'::jsonb,
  '{
    "reminder_24h": {"enabled": true, "trigger": "stage_enter:Agendamento", "action": "create_activity", "delay_hours": -24},
    "whatsapp_confirmation": {"enabled": true, "trigger": "stage_enter:Confirmação", "action": "send_template"},
    "reactivation_6months": {"enabled": true, "trigger": "stage_enter:Alta / Concluído", "action": "schedule_reactivation", "delay_days": 180}
  }'::jsonb,
  '{
    "system_prompt_vertical": "Você é o assistente de CRM especializado para clínicas médicas. Seu contexto:\n\n- NOMENCLATURA: Deals são Atendimentos. Contacts são Pacientes. O pipeline é a Jornada do Paciente.\n- FOCO: Relacionamento continuado com pacientes, reativação, redução de absenteísmo, gestão de convênios.\n- TOM: Profissional e empático. Use linguagem de saúde, nunca de vendas agressivas.\n- PRIORIDADES: (1) Pacientes com retorno atrasado, (2) Orçamentos de convênio pendentes, (3) Reativação de inativos > 6 meses.\n- LGPD: Nunca inclua dados clínicos sensíveis (diagnósticos, exames) em mensagens sugeridas.\n- MÉTRICAS: Priorize absenteísmo, taxa de retorno, receita por convênio.\n- FOLLOW-UP: Gere mensagens acolhedoras de pós-consulta focando no bem-estar do paciente.",
    "action_prompts": {
      "follow_up": "Gere uma mensagem de follow-up para este paciente. Seja acolhedor, pergunte sobre o bem-estar após o atendimento. Se houver retorno agendado, lembre gentilmente. NUNCA mencione diagnósticos ou resultados de exames.",
      "inbox_generate": "Analise este paciente e gere uma sugestão de ação prioritária. Considere: tempo desde última consulta, retornos pendentes, status de convênio.",
      "reactivation": "Este paciente está inativo há mais de 6 meses. Gere uma mensagem de reativação acolhedora, convidando para um check-up.",
      "analysis": "Analise o histórico deste paciente no CRM e forneça insights: frequência de consultas, padrão de comparecimento, risco de churn, sugestões de ações."
    },
    "priority_weights": {
      "financial_value": 0.15,
      "idle_days": 0.25,
      "ai_probability": 0.15,
      "temporal_urgency": 0.35,
      "recurrence_retention": 0.10
    }
  }'::jsonb,
  '[
    {"type": "kpi", "key": "absenteeism_rate", "label": "Taxa de Absenteísmo", "calc": "(nao_compareceram / agendados) * 100"},
    {"type": "list", "key": "today_schedule", "label": "Agenda de Hoje"},
    {"type": "donut", "key": "revenue_by_insurance", "label": "Receita por Convênio"},
    {"type": "kpi_list", "key": "reactivation_patients", "label": "Pacientes para Reativação"},
    {"type": "kpi", "key": "pending_authorizations", "label": "Autorizações Pendentes"},
    {"type": "timeline", "key": "scheduled_returns", "label": "Retornos Agendados"}
  ]'::jsonb,
  '{
    "stagnation_days": 3,
    "reactivation_months": 6,
    "absenteeism_alert_threshold": 20
  }'::jsonb,
  '{
    "pipeline_kanban": true,
    "contacts_management": true,
    "inbox_intelligent": true,
    "ai_central": true,
    "custom_fields": true,
    "scheduling_calendar": true,
    "absenteeism_tracking": true,
    "insurance_management": true,
    "budget_pipeline": false,
    "installment_tracking": false,
    "treatment_progress": false,
    "maintenance_recurrence": false,
    "property_management": false,
    "client_property_match": false,
    "visit_management": false,
    "commission_tracking": false,
    "broker_view": false
  }'::jsonb
)
ON CONFLICT (business_type) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. DENTAL CLINIC
-- ---------------------------------------------------------------------------
INSERT INTO vertical_configs (business_type, display_config, custom_fields_schema, default_pipeline_template, default_automations, ai_context, dashboard_widgets, inbox_rules, feature_flags)
VALUES (
  'dental_clinic',
  '{
    "deal_label": "Plano de Tratamento",
    "deal_label_plural": "Planos de Tratamento",
    "contact_label": "Paciente",
    "contact_label_plural": "Pacientes",
    "pipeline_label": "Funil de Tratamento",
    "activity_label": "Interação",
    "company_label": "Clínica / Unidade",
    "won_label": "Tratamento Concluído",
    "lost_label": "Orçamento Recusado"
  }'::jsonb,
  '{
    "contact": [
      {"key": "plano_odontologico", "label": "Plano Odontológico", "type": "select", "options_configurable": true, "required": false},
      {"key": "historico_tratamentos", "label": "Histórico de Tratamentos", "type": "text", "auto_fill": true, "required": false},
      {"key": "orcamento_pendente", "label": "Orçamento Pendente?", "type": "boolean", "auto_fill": true},
      {"key": "score_conversao", "label": "Score de Conversão", "type": "number", "min": 0, "max": 100, "auto_fill": true, "computed_by": "ai"},
      {"key": "ultima_manutencao", "label": "Última Manutenção", "type": "date"},
      {"key": "proxima_manutencao", "label": "Próxima Manutenção", "type": "date"}
    ],
    "deal": [
      {"key": "tipo_procedimento", "label": "Tipo de Procedimento", "type": "select", "options": ["Implante", "Ortodontia", "Protética", "Endodontia", "Periodontia", "Estética", "Cirurgia", "Outro"], "required": true},
      {"key": "valor_total", "label": "Valor Total", "type": "currency", "currency": "BRL", "required": true},
      {"key": "valor_entrada", "label": "Valor de Entrada", "type": "currency", "currency": "BRL"},
      {"key": "parcelamento", "label": "Parcelamento", "type": "text", "placeholder": "Ex: 12x R$500"},
      {"key": "status_orcamento", "label": "Status Orçamento", "type": "select", "options": ["Elaborando", "Enviado", "Negociando", "Aprovado", "Recusado"], "required": true},
      {"key": "fase_tratamento", "label": "Fase do Tratamento", "type": "select", "options": ["Planejamento", "Em Andamento", "Finalizado"]},
      {"key": "dentista_responsavel", "label": "Dentista Responsável", "type": "select", "source": "team_members", "required": true},
      {"key": "sessoes_previstas", "label": "Sessões Previstas", "type": "number"},
      {"key": "sessoes_realizadas", "label": "Sessões Realizadas", "type": "number", "auto_fill": true}
    ]
  }'::jsonb,
  '[
    {"order": 1, "name": "Avaliação Inicial", "color": "#3B82F6", "automation": "ai_evaluation_brief"},
    {"order": 2, "name": "Orçamento Enviado", "color": "#F59E0B", "automation": "followup_3days"},
    {"order": 3, "name": "Negociação", "color": "#8B5CF6", "automation": "ai_negotiation_args"},
    {"order": 4, "name": "Orçamento Aprovado", "color": "#10B981", "automation": "schedule_first_session"},
    {"order": 5, "name": "Tratamento em Andamento", "color": "#6366F1", "automation": "session_progress_tracking"},
    {"order": 6, "name": "Tratamento Concluído", "color": "#22C55E", "automation": "satisfaction_followup_maintenance"},
    {"order": 7, "name": "Manutenção Recorrente", "color": "#EC4899", "automation": "reminder_6months"}
  ]'::jsonb,
  '{
    "followup_3days": {"enabled": true, "trigger": "stage_enter:Orçamento Enviado", "action": "ai_followup", "delay_days": 3},
    "session_progress_tracking": {"enabled": true, "trigger": "activity_completed", "action": "update_session_count"},
    "reminder_6months": {"enabled": true, "trigger": "stage_enter:Tratamento Concluído", "action": "schedule_maintenance", "delay_days": 180}
  }'::jsonb,
  '{
    "system_prompt_vertical": "Você é o assistente de CRM especializado para clínicas odontológicas. Seu contexto:\n\n- NOMENCLATURA: Deals são Planos de Tratamento. Contacts são Pacientes. O pipeline é o Funil de Tratamento.\n- FOCO: Conversão de orçamentos, retenção de pacientes em tratamento, recorrência de manutenção.\n- TOM: Profissional, consultivo e persuasivo-sutil. Foque em benefícios de saúde bucal e estética.\n- PRIORIDADES: (1) Orçamentos enviados sem resposta > 3 dias, (2) Tratamentos com sessões atrasadas, (3) Pacientes sem manutenção > 6 meses.\n- NEGOCIAÇÃO: Ao sugerir follow-up de orçamento, use argumentos de saúde + facilidade de pagamento.\n- MÉTRICAS: Priorize taxa de conversão de orçamento, ticket médio, taxa de abandono de tratamento.\n- PARCELAMENTO: Quando relevante, mencione opções de parcelamento como argumento.",
    "action_prompts": {
      "follow_up": "Gere uma mensagem de follow-up para este orçamento/tratamento. Se orçamento pendente: reforce benefícios + facilidades de pagamento. Se tratamento em andamento: celebre progresso e reforce compromisso.",
      "inbox_generate": "Analise este Plano de Tratamento e gere uma sugestão de ação. Considere: dias desde último contato, status do orçamento, progresso de sessões, score de conversão.",
      "budget_followup": "Este orçamento está parado há mais de 3 dias. Gere uma mensagem persuasiva-sutil focando nos benefícios de saúde do procedimento e nas facilidades de pagamento.",
      "abandonment_alert": "Este paciente não comparece há 15+ dias com tratamento em andamento. Gere uma mensagem de reengajamento focando nos riscos de interromper o tratamento.",
      "analysis": "Analise este paciente: score de conversão, histórico de tratamentos, padrão de comparecimento, valor total investido, risco de abandono."
    },
    "priority_weights": {
      "financial_value": 0.30,
      "idle_days": 0.25,
      "ai_probability": 0.25,
      "temporal_urgency": 0.10,
      "recurrence_retention": 0.10
    }
  }'::jsonb,
  '[
    {"type": "kpi", "key": "budget_conversion_rate", "label": "Taxa de Conversão de Orçamento", "calc": "(aprovados / enviados) * 100"},
    {"type": "kpi", "key": "avg_ticket", "label": "Ticket Médio por Tratamento"},
    {"type": "list", "key": "pending_budgets", "label": "Orçamentos Pendentes"},
    {"type": "progress", "key": "treatments_in_progress", "label": "Tratamentos em Andamento"},
    {"type": "kpi_alert", "key": "treatment_abandonment", "label": "Abandono de Tratamento"},
    {"type": "kpi_list", "key": "maintenance_due", "label": "Manutenções Vencidas"}
  ]'::jsonb,
  '{
    "stagnation_days": 15,
    "budget_followup_days": 3,
    "maintenance_months": 6
  }'::jsonb,
  '{
    "pipeline_kanban": true,
    "contacts_management": true,
    "inbox_intelligent": true,
    "ai_central": true,
    "custom_fields": true,
    "scheduling_calendar": true,
    "absenteeism_tracking": false,
    "insurance_management": false,
    "budget_pipeline": true,
    "installment_tracking": true,
    "treatment_progress": true,
    "maintenance_recurrence": true,
    "property_management": false,
    "client_property_match": false,
    "visit_management": false,
    "commission_tracking": false,
    "broker_view": false
  }'::jsonb
)
ON CONFLICT (business_type) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. REAL ESTATE
-- ---------------------------------------------------------------------------
INSERT INTO vertical_configs (business_type, display_config, custom_fields_schema, default_pipeline_template, default_automations, ai_context, dashboard_widgets, inbox_rules, feature_flags)
VALUES (
  'real_estate',
  '{
    "deal_label": "Negociação",
    "deal_label_plural": "Negociações",
    "contact_label": "Cliente",
    "contact_label_plural": "Clientes",
    "pipeline_label": "Funil de Vendas",
    "activity_label": "Interação",
    "company_label": "Imobiliária / Filial",
    "won_label": "Contrato Fechado",
    "lost_label": "Negociação Perdida"
  }'::jsonb,
  '{
    "contact": [
      {"key": "tipo_cliente", "label": "Tipo de Cliente", "type": "select", "options": ["Comprador", "Vendedor", "Locatário", "Investidor"], "required": true},
      {"key": "faixa_orcamento_min", "label": "Orçamento Mínimo", "type": "currency", "currency": "BRL"},
      {"key": "faixa_orcamento_max", "label": "Orçamento Máximo", "type": "currency", "currency": "BRL"},
      {"key": "tipo_imovel_desejado", "label": "Tipo Imóvel Desejado", "type": "multi_select", "options": ["Apartamento", "Casa", "Comercial", "Terreno"]},
      {"key": "regiao_interesse", "label": "Região de Interesse", "type": "multi_select", "options_configurable": true},
      {"key": "quartos_minimo", "label": "Quartos Mínimo", "type": "number"},
      {"key": "aprovacao_financiamento", "label": "Financiamento Aprovado?", "type": "select", "options": ["Sim", "Não", "Em Análise", "Não Precisa"]},
      {"key": "banco_financiamento", "label": "Banco", "type": "text"}
    ],
    "deal": [
      {"key": "imovel_id", "label": "Imóvel Relacionado", "type": "fk", "references": "vertical_properties", "required": true},
      {"key": "corretor_responsavel", "label": "Corretor Responsável", "type": "select", "source": "team_members", "required": true},
      {"key": "comissao_percentual", "label": "Comissão (%)", "type": "decimal"},
      {"key": "comissao_valor", "label": "Valor Comissão", "type": "currency", "computed": true},
      {"key": "tipo_transacao", "label": "Tipo Transação", "type": "select", "options": ["Venda", "Locação"], "required": true},
      {"key": "data_visita", "label": "Data da Visita", "type": "datetime"},
      {"key": "feedback_visita", "label": "Feedback da Visita", "type": "textarea"},
      {"key": "proposta_valor", "label": "Valor da Proposta", "type": "currency"},
      {"key": "proposta_status", "label": "Status Proposta", "type": "select", "options": ["Pendente", "Aceita", "Contra-proposta", "Recusada"]}
    ]
  }'::jsonb,
  '[
    {"order": 1, "name": "Lead Captado", "color": "#3B82F6", "automation": "ai_property_match"},
    {"order": 2, "name": "Qualificação", "color": "#8B5CF6", "automation": "check_financing_preferences"},
    {"order": 3, "name": "Visita Agendada", "color": "#F59E0B", "automation": "reminder_24h_photos"},
    {"order": 4, "name": "Visita Realizada", "color": "#10B981", "automation": "ai_followup_feedback"},
    {"order": 5, "name": "Proposta Enviada", "color": "#6366F1", "automation": "followup_2days"},
    {"order": 6, "name": "Negociação", "color": "#EC4899", "automation": "ai_counter_arguments"},
    {"order": 7, "name": "Contrato / Fechamento", "color": "#22C55E", "automation": "calculate_commission"}
  ]'::jsonb,
  '{
    "ai_property_match": {"enabled": true, "trigger": "contact_created", "action": "run_matching"},
    "followup_2days": {"enabled": true, "trigger": "stage_enter:Proposta Enviada", "action": "ai_followup", "delay_days": 2},
    "calculate_commission": {"enabled": true, "trigger": "stage_enter:Contrato / Fechamento", "action": "calc_commission"}
  }'::jsonb,
  '{
    "system_prompt_vertical": "Você é o assistente de CRM especializado para imobiliárias. Seu contexto:\n\n- NOMENCLATURA: Deals são Negociações. Contacts são Clientes. O pipeline é o Funil de Vendas/Locação.\n- FOCO: Match cliente↔imóvel, conversão de visitas em propostas, gestão de corretores.\n- TOM: Profissional e consultivo. Use linguagem de mercado imobiliário. Seja específico sobre características dos imóveis.\n- PRIORIDADES: (1) Clientes qualificados sem visita agendada, (2) Visitas realizadas sem proposta, (3) Propostas sem resposta > 2 dias.\n- MATCH: Ao sugerir imóveis, cruze: tipo desejado, região de interesse, faixa de orçamento, nº quartos.\n- MÉTRICAS: Priorize taxa de conversão visita→proposta, tempo médio de fechamento, volume por corretor.\n- FOLLOW-UP: Pós-visita, referencie características específicas do imóvel visitado e o feedback registrado.",
    "action_prompts": {
      "follow_up": "Gere uma mensagem de follow-up para esta negociação. Se pós-visita: referencie o imóvel visitado e o feedback. Se proposta pendente: crie senso de urgência sutil.",
      "inbox_generate": "Analise esta negociação e gere uma sugestão de ação. Considere: dias desde último contato, stage atual, feedback de visitas, status de proposta.",
      "property_match": "Cruze as preferências deste cliente com os imóveis disponíveis. Retorne os top 5 matches com score de compatibilidade (0-100) e justificativa.",
      "visit_followup": "Visita realizada ao imóvel. Gere mensagem personalizada referenciando: endereço/bairro, características destacadas, e o feedback registrado.",
      "analysis": "Analise este cliente: perfil de compra, histórico de visitas, propostas enviadas, tempo no funil, probabilidade de fechamento."
    },
    "priority_weights": {
      "financial_value": 0.35,
      "idle_days": 0.25,
      "ai_probability": 0.20,
      "temporal_urgency": 0.10,
      "recurrence_retention": 0.10
    }
  }'::jsonb,
  '[
    {"type": "bar", "key": "deals_by_broker", "label": "Negociações por Corretor"},
    {"type": "kpi", "key": "visit_to_proposal_rate", "label": "Conversão Visita → Proposta", "calc": "(propostas / visitas) * 100"},
    {"type": "kpi_breakdown", "key": "monthly_commissions", "label": "Comissões do Mês"},
    {"type": "kpi", "key": "available_properties", "label": "Imóveis Disponíveis"},
    {"type": "list", "key": "pending_matches", "label": "Matches Pendentes"},
    {"type": "kpi", "key": "avg_closing_time", "label": "Tempo Médio de Fechamento"}
  ]'::jsonb,
  '{
    "visit_followup_days": 2,
    "proposal_followup_days": 2,
    "matching_interval_hours": 4
  }'::jsonb,
  '{
    "pipeline_kanban": true,
    "contacts_management": true,
    "inbox_intelligent": true,
    "ai_central": true,
    "custom_fields": true,
    "scheduling_calendar": false,
    "absenteeism_tracking": false,
    "insurance_management": false,
    "budget_pipeline": false,
    "installment_tracking": false,
    "treatment_progress": false,
    "maintenance_recurrence": false,
    "property_management": true,
    "client_property_match": true,
    "visit_management": true,
    "commission_tracking": true,
    "broker_view": true
  }'::jsonb
)
ON CONFLICT (business_type) DO NOTHING;
