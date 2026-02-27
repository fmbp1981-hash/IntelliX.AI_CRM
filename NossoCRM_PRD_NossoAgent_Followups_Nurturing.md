# NossoCRM — PRD Addendum: NossoAgent Follow-ups, Nurturing & Jornada do Cliente

> **Versão:** 1.0 — 24 de Fevereiro de 2026
> **Status:** Draft — Para Implementação
> **Tipo:** Addendum ao PRD NossoAgent (estende Seções 3, 4, 7 e 8 do PRD NossoAgent)
> **Confidencialidade:** Interno — IntelliX.AI

---

## IMPORTANTE: Contexto

Este documento é um **addendum** ao PRD NossoAgent. Adiciona funcionalidades de follow-up proativo, nurturing de leads, jornada completa do paciente/cliente, e automações outbound que o agente executa autonomamente via WhatsApp. Todas as funcionalidades utilizam a infraestrutura já definida no PRD principal (tabelas `conversations`, `messages`, `agent_configs`, `agent_tools_log`, Edge Functions, Supabase Realtime).

As cadências de follow-up e reativação foram definidas com base em pesquisa de melhores práticas de mercado por nicho:

- **Clínicas (médicas/odontológicas):** Reativação de pacientes inativos 5-25x mais barata que aquisição. 4-5 touchpoints aumentam taxa de reativação em 81%. No-shows custam estimados USD 150 bilhões/ano (dados ADA e Musculoskeletal Science and Practice, 2025).
- **Imobiliárias:** 95% dos leads convertem após 2-12 follow-ups. Ciclo médio de 6-24 meses. Resposta em < 5 minutos aumenta conversão em 9x (dados BoomTown, Luxury Presence, 2025).

---

## 1. Arquitetura do Sistema de Follow-ups

### 1.1 Princípio Fundamental

> **REGRA:** O NossoAgent não espera o lead voltar. Ele **nutre proativamente** através de sequências inteligentes que respeitam timing, contexto e vertical. Cada follow-up é gerado pela IA com base no histórico real da conversa e no estado atual do CRM — nunca é uma mensagem genérica pré-escrita.

### 1.2 Tipos de Follow-up

O sistema opera em **5 camadas** de follow-up, do mais urgente ao mais longo prazo:

| Camada | Nome | Timing | Trigger | Objetivo |
|---|---|---|---|---|
| 1 | **Quick Follow-up** | 30min — 24h | Lead parou de responder durante conversa ativa | Reengajar na mesma sessão |
| 2 | **Warm Follow-up** | 1-3 dias | Conversa esfriou, lead não retornou | Retomar interesse antes de esfriar |
| 3 | **Pipeline Follow-up** | 3-14 dias | Deal parado em algum stage sem atualização | Avançar o deal no pipeline |
| 4 | **Remarketing/Nurturing** | 15-90 dias | Lead não converteu, foi para stage de remarketing | Manter top-of-mind e reativar |
| 5 | **Reactivation** | 3-12+ meses | Paciente/cliente inativo por longo período | Trazer de volta ao funil ativo |

### 1.3 Modelo de Dados — Extensão

#### 1.3.1 Tabela: followup_sequences

Armazena as sequências de follow-up configuradas e suas execuções.

```sql
-- Migration: create_followup_sequences
CREATE TABLE followup_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Identificação
  name TEXT NOT NULL,
  sequence_type TEXT NOT NULL,
  -- 'quick' | 'warm' | 'pipeline' | 'remarketing' | 'reactivation'
  vertical_type TEXT NOT NULL DEFAULT 'generic',
  -- 'generic' | 'medical_clinic' | 'dental_clinic' | 'real_estate'

  -- Configuração
  is_active BOOLEAN NOT NULL DEFAULT true,
  steps JSONB NOT NULL DEFAULT '[]',
  -- Array de steps com delay, prompt, condição, canal

  -- Condições de Ativação
  trigger_condition JSONB NOT NULL DEFAULT '{}',
  -- { type: "conversation_idle", idle_minutes: 30 }
  -- { type: "deal_stagnant", stage_name: "Orçamento Enviado", stagnant_days: 3 }
  -- { type: "contact_inactive", inactive_months: 6 }
  -- { type: "deal_stage", stage_name: "Remarketing" }

  -- Condições de Parada
  stop_conditions JSONB NOT NULL DEFAULT '["lead_replied", "deal_won", "deal_lost", "unsubscribed"]',

  -- Rate Limiting
  max_messages_per_day INT NOT NULL DEFAULT 2,
  respect_business_hours BOOLEAN NOT NULL DEFAULT true,
  min_hours_between_messages INT NOT NULL DEFAULT 4,

  -- Janela do WhatsApp
  respect_24h_window BOOLEAN NOT NULL DEFAULT true,
  template_message_id TEXT,
  -- ID do template aprovado pela Meta para mensagens fora da janela de 24h

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE followup_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON followup_sequences
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));
CREATE INDEX idx_fs_org_type ON followup_sequences(organization_id, sequence_type);
CREATE INDEX idx_fs_vertical ON followup_sequences(organization_id, vertical_type);
```

#### 1.3.2 Tabela: followup_executions

Tracking de cada execução de follow-up por conversa.

```sql
-- Migration: create_followup_executions
CREATE TABLE followup_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  sequence_id UUID NOT NULL REFERENCES followup_sequences(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  contact_id UUID REFERENCES contacts(id),
  deal_id UUID REFERENCES deals(id),

  -- Status
  status TEXT NOT NULL DEFAULT 'active',
  -- 'active' | 'paused' | 'completed' | 'cancelled' | 'stopped_by_reply'
  current_step INT NOT NULL DEFAULT 0,

  -- Tracking
  messages_sent INT NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  next_scheduled_at TIMESTAMPTZ,

  -- Resultado
  result TEXT,
  -- 'lead_replied' | 'converted' | 'unsubscribed' | 'max_attempts' | 'manual_stop'
  result_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE followup_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON followup_executions
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));
CREATE INDEX idx_fe_next ON followup_executions(next_scheduled_at) WHERE status = 'active';
CREATE INDEX idx_fe_conv ON followup_executions(conversation_id);
CREATE INDEX idx_fe_org_status ON followup_executions(organization_id, status);
```

#### 1.3.3 Tabela: appointment_reminders (Clínicas)

Controle dedicado de lembretes e jornada de consultas.

```sql
-- Migration: create_appointment_reminders
CREATE TABLE appointment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  deal_id UUID NOT NULL REFERENCES deals(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  conversation_id UUID REFERENCES conversations(id),

  -- Agendamento
  appointment_datetime TIMESTAMPTZ NOT NULL,
  appointment_type TEXT NOT NULL,
  -- 'consulta' | 'exame' | 'cirurgia' | 'retorno' | 'avaliacao' | 'manutencao'
  professional_name TEXT,
  location_info TEXT,

  -- Preparação
  preparation_instructions JSONB DEFAULT '[]',
  -- [{ "type": "jejum", "description": "Jejum de 8 horas antes do exame", "hours_before": 8 }]
  -- [{ "type": "exame", "description": "Trazer exame de sangue recente (últimos 30 dias)" }]
  -- [{ "type": "documento", "description": "Trazer documento com foto e carteirinha do convênio" }]
  -- [{ "type": "medicamento", "description": "Suspender anticoagulantes 48h antes" }]
  required_documents JSONB DEFAULT '[]',

  -- Lembretes
  reminders_config JSONB NOT NULL DEFAULT '[
    { "type": "7d", "days_before": 7, "sent": false, "sent_at": null },
    { "type": "2d", "days_before": 2, "sent": false, "sent_at": null },
    { "type": "1d", "days_before": 1, "sent": false, "sent_at": null },
    { "type": "day", "days_before": 0, "hours_before": 3, "sent": false, "sent_at": null }
  ]',

  -- Confirmação
  confirmed BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  cancelled BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  rescheduled_to TIMESTAMPTZ,

  -- Pós-atendimento
  attended BOOLEAN,
  -- null = pendente, true = compareceu, false = faltou
  satisfaction_survey_sent BOOLEAN DEFAULT false,
  satisfaction_survey_sent_at TIMESTAMPTZ,
  satisfaction_score INT,
  -- 1-5 estrelas
  satisfaction_feedback TEXT,
  post_care_instructions_sent BOOLEAN DEFAULT false,

  -- Follow-up de retorno
  return_recommended BOOLEAN DEFAULT false,
  return_date TIMESTAMPTZ,
  return_reminder_sent BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON appointment_reminders
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));
CREATE INDEX idx_ar_upcoming ON appointment_reminders(appointment_datetime)
  WHERE attended IS NULL AND cancelled = false;
CREATE INDEX idx_ar_org ON appointment_reminders(organization_id, appointment_datetime);
CREATE INDEX idx_ar_contact ON appointment_reminders(contact_id);
```

#### 1.3.4 Tabela: property_journey (Imobiliárias)

Controle dedicado da jornada do cliente imobiliário.

```sql
-- Migration: create_property_journey
CREATE TABLE property_journey (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  deal_id UUID NOT NULL REFERENCES deals(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  conversation_id UUID REFERENCES conversations(id),

  -- Visita
  property_id UUID REFERENCES vertical_properties(id),
  visit_datetime TIMESTAMPTZ,
  visit_type TEXT,
  -- 'presencial' | 'virtual' | 'video_call'

  -- Lembretes de Visita
  visit_reminders_config JSONB NOT NULL DEFAULT '[
    { "type": "2d", "days_before": 2, "sent": false, "sent_at": null },
    { "type": "1d", "days_before": 1, "sent": false, "sent_at": null },
    { "type": "day", "hours_before": 2, "sent": false, "sent_at": null }
  ]',

  -- Informações Pré-Visita
  pre_visit_info_sent BOOLEAN DEFAULT false,
  property_highlights JSONB DEFAULT '[]',
  neighborhood_info JSONB DEFAULT '{}',
  -- { escolas: [...], supermercados: [...], transporte: [...] }
  route_info TEXT,

  -- Confirmação
  confirmed BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  cancelled BOOLEAN DEFAULT false,
  rescheduled_to TIMESTAMPTZ,

  -- Pós-Visita
  visit_completed BOOLEAN DEFAULT false,
  feedback_collected BOOLEAN DEFAULT false,
  feedback_score INT,
  -- 1-5: quanto gostou do imóvel
  feedback_text TEXT,
  feedback_objections JSONB DEFAULT '[]',
  -- ["preço alto", "localização distante", "precisa reforma"]

  -- Match
  alternative_properties_sent BOOLEAN DEFAULT false,
  alternatives_sent_at TIMESTAMPTZ,

  -- Proposta
  proposal_sent BOOLEAN DEFAULT false,
  proposal_value DECIMAL(12,2),
  proposal_sent_at TIMESTAMPTZ,
  proposal_followup_count INT DEFAULT 0,

  -- Documentação (pós-aceite)
  documentation_checklist JSONB DEFAULT '[]',
  -- [{ "item": "Comprovante de renda", "status": "pendente" | "recebido" }]
  documentation_reminder_sent BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE property_journey ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON property_journey
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));
CREATE INDEX idx_pj_upcoming ON property_journey(visit_datetime)
  WHERE visit_completed = false AND cancelled = false;
CREATE INDEX idx_pj_org ON property_journey(organization_id);
CREATE INDEX idx_pj_contact ON property_journey(contact_id);
```

### 1.4 Estrutura de Steps das Sequências

Cada step de uma sequência segue esta estrutura:

```typescript
interface FollowupStep {
  step_number: number;
  delay_minutes: number;
  // Tempo de espera desde o step anterior (ou desde o trigger)
  // Ex: 30 (30min), 1440 (24h), 4320 (3 dias), 43200 (30 dias)

  message_type: 'ai_generated' | 'template' | 'template_with_ai';
  // ai_generated: IA gera mensagem do zero baseada no contexto
  // template: Mensagem fixa (para fora da janela 24h do WhatsApp)
  // template_with_ai: Template base que IA personaliza com variáveis

  message_prompt: string;
  // Instruções para a IA gerar a mensagem

  condition?: string;
  // Condição opcional para executar este step
  // Ex: "deal.stage == 'Orçamento Enviado'"

  channel: 'whatsapp' | 'whatsapp_template';

  fallback_to_template: boolean;
  // Se true e janela 24h expirou, usa template_message_id da sequência

  create_inbox_item: boolean;
  // Se true, cria action item na Inbox para follow-up manual (humano)

  max_retry: number;
}
```

---

## 2. Sequências de Follow-up por Vertical

### 2.1 Cadência Genérica (B2B)

#### Quick Follow-up — Conversa Ativa

| Step | Delay | Mensagem (IA Gera) | Condição |
|---|---|---|---|
| 1 | 30 min | "Verificação gentil se o lead ainda está aí. Referencia último assunto discutido." | Última msg foi do agente e lead não respondeu |
| 2 | 4h | "Resumo do que foi discutido + pergunta aberta para retomar." | Lead não respondeu step 1 |
| 3 | 24h | "Mensagem de disponibilidade: 'Estou aqui quando precisar. Posso ajudar com algo mais?'" | Lead não respondeu step 2 |

**Stop conditions:** Lead respondeu, deal fechado, lead pediu para parar.

#### Warm Follow-up — Conversa Esfriou

| Step | Delay | Mensagem (IA Gera) | Condição |
|---|---|---|---|
| 1 | 2 dias | "Retomada amigável referenciando interesse demonstrado. Traz novidade ou informação útil." | Conversa inativa > 48h |
| 2 | 5 dias | "Compartilha conteúdo de valor relevante ao interesse. Pergunta se houve mudança de necessidade." | Lead não respondeu step 1 |
| 3 | 10 dias | "Última tentativa: resumo da proposta + oferta de agendamento. Gera action item para humano." | Lead não respondeu step 2 |

#### Remarketing — Lead Não Converteu

| Step | Delay | Mensagem (IA Gera) |
|---|---|---|
| 1 | 15 dias | "Check-in leve: 'Passou um tempo desde nosso contato. Alguma novidade no seu projeto?'" |
| 2 | 30 dias | "Conteúdo educativo relevante ao segmento. Posicionamento como autoridade." |
| 3 | 60 dias | "Novidades da empresa/produto que possam interessar. Convite para retomar conversa." |
| 4 | 90 dias | "Última tentativa do ciclo. Se sem resposta, marca contato como 'frio' e pausa." |

---

### 2.2 Clínicas Médicas

#### 2.2.1 Quick Follow-up — Paciente em Conversa

| Step | Delay | Mensagem (IA Gera) | Condição |
|---|---|---|---|
| 1 | 20 min | "Gentil: 'Estou aqui caso precise de mais alguma informação sobre a consulta/exame.'" | Paciente parou de responder durante agendamento |
| 2 | 3h | "Retoma com facilitador: 'Se preferir, posso verificar outros horários disponíveis para você.'" | Sem resposta |
| 3 | 24h | "Reforço de cuidado: 'Sua saúde é importante para nós. Estou à disposição quando quiser agendar.'" | Sem resposta |

#### 2.2.2 Pipeline Follow-up — Agendamento Pendente

| Step | Delay | Mensagem (IA Gera) | Condição |
|---|---|---|---|
| 1 | 2 dias | "Lembrete gentil que a vaga ainda está disponível. Menciona médico e especialidade." | Deal em stage "Primeiro Contato" sem avanço |
| 2 | 5 dias | "Menciona importância do check-up preventivo. Se convênio: 'Sua cobertura permite essa consulta sem custo.'" | Sem resposta |
| 3 | 10 dias | "Última tentativa + oferta de horário facilitado. Gera action item para secretária ligar." | Sem resposta |

#### 2.2.3 Reativação — Paciente Inativo

Baseado em pesquisa: pacientes sem visita em 6-12 meses são o público-alvo principal. Sequência de 4-5 touchpoints com intervalo de 1-2 semanas.

| Step | Delay desde ativação | Mensagem (IA Gera) | Canal |
|---|---|---|---|
| 1 | Imediato | "Mensagem acolhedora: 'Faz tempo que não nos vemos! Gostaríamos de saber como você está. Que tal agendar um check-up?'" | WhatsApp Template* |
| 2 | 10 dias | "Conteúdo educativo: dica de saúde preventiva relevante à especialidade do último atendimento." | WhatsApp Template |
| 3 | 25 dias | "Menção de novidades da clínica (novo equipamento, novo médico, horários estendidos)." | WhatsApp Template |
| 4 | 45 dias | "Oferta especial: check-up preventivo com condição facilitada." | WhatsApp Template |
| 5 | 70 dias | "Última tentativa: mensagem empática de cuidado. Se sem resposta, marca como 'inativo'." | WhatsApp Template |

*\*Template messages pois a janela de 24h do WhatsApp está fechada após meses de inatividade.*

**Triggers de ativação automática via pg_cron:**
- Paciente sem consulta há **6 meses** → Ativa sequência de reativação (nível leve)
- Paciente sem consulta há **12 meses** → Ativa sequência de reativação (nível urgente)
- Paciente com retorno agendado **vencido há 30+ dias** → Ativa sequência de retorno

#### 2.2.4 Jornada Completa de Consulta

Este é o diferencial mais robusto para clínicas. O NossoAgent gerencia toda a jornada do paciente.

```
AGENDAMENTO → PRÉ-CONSULTA → LEMBRETES → DIA DA CONSULTA → PÓS-CONSULTA → PESQUISA → RETORNO
     │              │              │              │               │             │          │
     ▼              ▼              ▼              ▼               ▼             ▼          ▼
  Confirma      Instruções    7d, 2d, 1d,     Boas-vindas    Orientações   NPS 1-5    Reativação
  data/hora     de preparo     no dia         + check-in     pós-cuidado   + feedback  automática
```

**Fase 1 — Agendamento (no momento da conversa)**

O agente usa o tool `schedule_appointment` para confirmar data, hora e profissional, registrar em `appointment_reminders`, e enviar confirmação:

> "Consulta confirmada! Dr. [nome], [data] às [hora]. Endereço: [local]. Vou te enviar as orientações de preparo mais perto da data."

**Fase 2 — Informações de Preparo (7 dias antes)**

O agente envia automaticamente as instruções de preparo configuradas:

> Olá [nome]! Sua consulta com Dr. [médico] está confirmada para [data].
>
> Para que tudo corra bem, seguem as orientações:
>
> Exames necessários: Hemograma completo (últimos 30 dias), Glicemia em jejum
>
> Preparação: Jejum de 8 horas antes do procedimento. Suspender uso de [medicamento] 48h antes (confira com seu médico).
>
> Documentos para trazer: Documento com foto (RG ou CNH), Carteirinha do convênio [nome], Exames anteriores.
>
> Qualquer dúvida, estou aqui!

**Fase 3 — Lembretes Progressivos**

| Momento | Mensagem | Ação Esperada |
|---|---|---|
| **7 dias antes** | Instruções de preparo completas + confirmação de presença | Paciente confirma ou reagenda |
| **2 dias antes** | "Lembrete: sua consulta é em 2 dias! Já providenciou os exames necessários? Se precisar reagendar, me avise." | Verificação de preparo |
| **1 dia antes** | "Amanhã é o dia! Consulta às [hora] com Dr. [nome]. Lembre-se do jejum de 8h. Precisa de algo?" | Confirmação final |
| **No dia (3h antes)** | "Bom dia [nome]! Sua consulta é HOJE às [hora]. Estamos esperando você! Endereço: [local]." | Check-in final |

**Lógica de confirmação:**
- Se paciente confirma → Marca `confirmed = true`
- Se paciente pede para reagendar → Agente agenda nova data, atualiza `rescheduled_to`, reinicia ciclo
- Se paciente cancela → Marca `cancelled = true`, registra motivo, gera action item para secretária
- Se paciente não responde ao último lembrete → Gera action item CRÍTICO: "Paciente não confirmou consulta de amanhã"

**Fase 4 — Pós-Consulta (2-4h depois do horário agendado)**

Se `attended = true`:

> Olá [nome]! Esperamos que sua consulta tenha sido boa!
>
> O Dr. [médico] pediu para reforçar:
> - [Orientações pós-procedimento personalizadas]
> - [Medicamentos prescritos e horários, se aplicável]
> - [Restrições: não fazer esforço físico por 48h, etc.]
>
> Se tiver qualquer dúvida sobre o pós-atendimento, estou aqui!

Se `attended = false` (no-show):

> Olá [nome], sentimos sua falta hoje na consulta com Dr. [médico].
>
> Sabemos que imprevistos acontecem! Gostaria de reagendar para outro dia?
> Tenho horários disponíveis esta semana:
> - [data 1] às [hora]
> - [data 2] às [hora]
> - [data 3] às [hora]
>
> Sua saúde é prioridade para nós.

**Fase 5 — Pesquisa de Satisfação (24-48h após consulta)**

> Olá [nome]! Gostaríamos de saber como foi sua experiência conosco.
>
> Em uma escala de 1 a 5, como você avalia o atendimento geral da clínica?
> (Responda com um número de 1 a 5)

Após a nota:
- **Se 4-5:** "Que bom! Ficamos muito felizes! Se quiser deixar mais algum comentário, estou ouvindo."
- **Se 1-3:** "Lamentamos que sua experiência não tenha sido ideal. Pode nos contar o que podemos melhorar? Vou encaminhar para nossa equipe de qualidade." → Gera action item CRÍTICO + transfere para humano.

O score e feedback são salvos em `appointment_reminders.satisfaction_score` e `satisfaction_feedback`.

**Fase 6 — Follow-up de Retorno**

Se o médico recomendou retorno (`return_recommended = true`):

| Momento | Mensagem |
|---|---|
| **30 dias antes do retorno** | "Olá [nome]! Lembrete: Dr. [médico] recomendou retorno para [data]. Gostaria de confirmar?" |
| **15 dias antes** | "Sua consulta de retorno está se aproximando! Posso confirmar para [data] às [hora]?" |
| **Se retorno vencido** | Entra automaticamente na sequência de reativação |

---

### 2.3 Clínicas Odontológicas

#### 2.3.1 Pipeline Follow-up — Orçamento Parado

| Step | Delay | Mensagem (IA Gera) | Contexto IA |
|---|---|---|---|
| 1 | 3 dias | "Follow-up consultivo: reforça benefícios de saúde do procedimento específico. Menciona facilidade de pagamento." | Tipo de procedimento + valor + parcelamento |
| 2 | 7 dias | "Conteúdo educativo: explica consequências de adiar o tratamento (específico). Empático, não alarmista." | Tipo de procedimento |
| 3 | 14 dias | "Oferta de facilitação: 'Temos novas opções de parcelamento em até Xx. Gostaria de conversar?'" | Valor + opções de pagamento |
| 4 | 21 dias | "Proposta de procedimento alternativo se aplicável: 'Existem opções com valores diferentes para resultado parecido.'" | Tipo + alternativas |
| 5 | 30 dias | "Última tentativa gentil. Gera action item para dentista ligar pessoalmente. Move deal para 'Remarketing'." | Contexto completo |

#### 2.3.2 Tratamento em Andamento — Abandono

| Step | Delay desde última sessão | Mensagem |
|---|---|---|
| 1 | 15 dias | "Notamos que faz um tempinho desde sua última sessão. Está tudo bem? Quando podemos agendar a próxima? Você está na sessão [X] de [Y] — estamos quase lá!" |
| 2 | 25 dias | "Alerta empático sobre riscos de interromper: 'Pausar o tratamento nesta fase pode [risco específico ao procedimento]. Queremos garantir o melhor resultado.'" |
| 3 | 40 dias | "Mensagem do dentista (redigida por IA): reforço profissional + facilitação de horário. Gera action item CRÍTICO." |

#### 2.3.3 Manutenção Periódica

Ciclo automático para pacientes com tratamento concluído:

| Momento | Mensagem | Trigger |
|---|---|---|
| **5 meses** (1 mês antes) | "Sua manutenção semestral está se aproximando! Dr. [nome] recomenda que voltemos a nos ver. Posso agendar?" | `ultima_manutencao` + 5 meses |
| **6 meses** | "É hora da sua manutenção! A limpeza periódica mantém seus resultados. Horários disponíveis esta semana: [lista]" | `ultima_manutencao` + 6 meses |
| **7 meses** | "Faz 1 mês que sua manutenção estava prevista. 30 minutinhos podem fazer toda diferença para seu sorriso!" | Sem resposta |
| **9 meses** | "Última tentativa: reforço dos benefícios preventivos. Gera action item para equipe." | Sem resposta |

#### 2.3.4 Reativação Odontológica

| Inatividade | Abordagem | Touchpoints |
|---|---|---|
| **6-12 meses** | "Saudade": convite para retorno + benefício preventivo | 4 msgs em 45 dias |
| **12-18 meses** | "Novidades": novo equipamento/técnica + condição especial | 3 msgs em 30 dias |
| **18+ meses** | "Reconexão": mensagem empática + avaliação gratuita | 2 msgs em 20 dias |

---

### 2.4 Imobiliárias

#### 2.4.1 Quick Follow-up — Lead Novo

| Step | Delay | Mensagem (IA Gera) |
|---|---|---|
| 1 | **5 minutos** | "Resposta imediata: agradece interesse, confirma que é o assessor, pergunta preferências básicas." |
| 2 | 1h | "Se não respondeu: reforça disponibilidade + envia 1-2 destaques de imóveis baseados no contexto." |
| 3 | 24h | "Abordagem consultiva: 'Vi que você tem interesse em [região/tipo]. O mercado nesta área está [tendência]. Posso preparar uma seleção personalizada?'" |

#### 2.4.2 Pipeline Follow-up — Visita sem Proposta

| Step | Delay | Mensagem (IA Gera) | Contexto |
|---|---|---|---|
| 1 | 24h | "Follow-up pós-visita: 'O que achou do [imóvel]? Algum ponto que chamou atenção especial?'" | Imóvel visitado + endereço |
| 2 | 3 dias | "Se feedback positivo: opções de proposta. Se negativo: '[X] alternativas que podem te agradar mais.'" | Feedback + novos matches |
| 3 | 7 dias | "Market insight: 'Imóveis nesta faixa em [região] estão com boa procura. Vale a pena avançar?'" | Dados de mercado |
| 4 | 14 dias | "Novo imóvel: envio curado que matchou com preferências. 'Acabou de entrar um [tipo] em [região]!'" | Match automático |

#### 2.4.3 Jornada Completa de Visita

```
MATCH → AGENDAMENTO → PRÉ-VISITA → LEMBRETES → VISITA → FEEDBACK → PROPOSTA → DOCUMENTAÇÃO
  │          │              │            │          │         │          │            │
  ▼          ▼              ▼            ▼          ▼         ▼          ▼            ▼
Top 5     Confirma     Highlights   2d, 1d,    Check-in  Coleta    Follow-up    Checklist
imóveis   data/hora    do imóvel    no dia     corretor  opinião   proposta     docs
```

**Fase 1 — Match + Agendamento**

O agente faz match (PRD principal). Ao agendar visita, cria registro em `property_journey`.

**Fase 2 — Pré-Visita (2 dias antes)**

> Olá [nome]! Sua visita ao imóvel está confirmada para [data] às [hora].
>
> Endereço: [endereço completo] — Como chegar: [link Google Maps]
>
> Destaques do imóvel: [X] quartos, [Y]m², [Z] vagas. [Feature 1], [Feature 2].
>
> Sobre o bairro: Escolas próximas: [nome, distância]. Supermercados: [nome]. Transporte: [estação, distância].
>
> Seu corretor [nome] estará te esperando no local!

**Fase 3 — Lembretes**

| Momento | Mensagem |
|---|---|
| **2 dias antes** | Informações completas do imóvel + bairro |
| **1 dia antes** | "Amanhã é dia de visita! [endereço] às [hora]. [Corretor] estará te esperando." |
| **No dia (2h antes)** | "Sua visita é HOJE às [hora]! Endereço: [link Maps]. Nos vemos em breve!" |

**Fase 4 — Pós-Visita (2-4h depois)**

> Olá [nome]! Como foi a visita ao [tipo do imóvel] em [bairro]?
> De 1 a 5, quanto o imóvel atendeu às suas expectativas?

Após o score:
- **Se 4-5:** "Ótimo! Quer que eu prepare uma simulação de proposta?"
- **Se 3:** "O que sentiu falta? Consigo refinar minha busca."
- **Se 1-2:** "Obrigado pela honestidade! Vou buscar opções melhores. Já tenho [X] alternativas."

Objeções salvas em `property_journey.feedback_objections` e usadas pelo `property_match` para refinar sugestões.

**Fase 5 — Proposta + Documentação**

Após proposta aceita:

> Parabéns [nome]! Proposta aceita! Vamos cuidar da documentação.
>
> Documentos necessários: RG e CPF, Comprovante de renda (3 últimos meses), Comprovante de residência, Extrato bancário (3 últimos meses), Carta de aprovação de financiamento [banco].
>
> Pode enviar os documentos por aqui mesmo! Irei marcando conforme receber.
> Prazo ideal: [data] para não atrasar a escritura.

O agente marca cada documento em `property_journey.documentation_checklist` e cobra os pendentes periodicamente.

#### 2.4.4 Remarketing Imobiliário — Lead "Frio"

| Step | Delay | Mensagem (IA Gera) | Foco |
|---|---|---|---|
| 1 | 15 dias | "Novos imóveis na região de interesse. 'Entraram [X] novos [tipo] em [bairro] esta semana.'" | Novidades de match |
| 2 | 30 dias | "Market insight: 'Preços em [região] tiveram [tendência] de [X]% no último mês.'" | Dados de mercado |
| 3 | 60 dias | "Dica sobre financiamento, mercado, ou processo de compra. Posiciona como consultor." | Educação |
| 4 | 90 dias | "Check-in: 'Ainda pensando em [comprar/alugar]? O mercado está [favorável/estável].'" | Reengajamento |
| 5 | 120 dias | "Oferta exclusiva ou imóvel com desconto especial. Última tentativa ativa." | Conversão |
| 6 | 180 dias | "Anual: 'Faz 6 meses! Seu perfil de busca mudou? Posso refazer sugestões.'" | Atualização |

#### 2.4.5 Reativação — Cliente Inativo

| Inatividade | Abordagem |
|---|---|
| **3-6 meses** | Novos imóveis curados + update de mercado |
| **6-12 meses** | Check-in + atualização de preferências |
| **12+ meses** | Reconexão: "Mercado mudou muito. Nova análise?" |

---

## 3. Agent Tools Adicionais

Estes tools se somam aos já definidos no PRD principal (create_contact, create_deal, move_deal, etc.):

```typescript
// Adição ao lib/ai/agent-tools.ts

// ── FOLLOW-UPS ──
schedule_followup: tool({
  description: 'Agenda uma sequência de follow-up para esta conversa. Use quando o lead não está respondendo ou precisa de nurturing.',
  parameters: z.object({
    sequence_type: z.enum(['quick', 'warm', 'pipeline', 'remarketing', 'reactivation']),
    reason: z.string().describe('Motivo do follow-up'),
    custom_delay_minutes: z.number().optional().describe('Delay customizado para primeiro step'),
  }),
  execute: async (params, { organizationId, conversationId }) => {
    // Busca sequência padrão da vertical para o tipo
    // Cria followup_execution
    // Calcula next_scheduled_at do primeiro step
  },
}),

cancel_followup: tool({
  description: 'Cancela sequência de follow-up ativa. Use quando o lead respondeu ou contexto mudou.',
  parameters: z.object({
    reason: z.string(),
  }),
  execute: async (params, { organizationId, conversationId }) => {
    // UPDATE followup_executions SET status = 'cancelled'
  },
}),

// ── CONSULTAS (CLÍNICAS) ──
schedule_appointment: tool({
  description: '[CLÍNICAS] Agenda uma consulta/procedimento e ativa toda a jornada de lembretes.',
  parameters: z.object({
    appointment_datetime: z.string().datetime(),
    appointment_type: z.enum(['consulta', 'exame', 'cirurgia', 'retorno', 'avaliacao', 'manutencao']),
    professional_name: z.string(),
    location_info: z.string().optional(),
    preparation_instructions: z.array(z.object({
      type: z.string(),
      description: z.string(),
      hours_before: z.number().optional(),
    })).optional(),
    required_documents: z.array(z.string()).optional(),
    return_recommended: z.boolean().optional(),
    return_date: z.string().datetime().optional(),
  }),
  execute: async (params, { organizationId, conversationId, contactId, dealId }) => {
    // INSERT em appointment_reminders com toda a config
    // Calcula datas dos lembretes
    // Move deal para stage "Agendamento" ou "Confirmação"
    // Atualiza custom_field: data_agendamento, status_agendamento
  },
}),

reschedule_appointment: tool({
  description: '[CLÍNICAS] Reagenda uma consulta existente.',
  parameters: z.object({
    appointment_id: z.string().uuid(),
    new_datetime: z.string().datetime(),
    reason: z.string().optional(),
  }),
  execute: async (params) => {
    // UPDATE appointment_reminders
    // Recalcula lembretes
    // Envia confirmação de remarcação
  },
}),

cancel_appointment: tool({
  description: '[CLÍNICAS] Cancela uma consulta.',
  parameters: z.object({
    appointment_id: z.string().uuid(),
    reason: z.string(),
  }),
  execute: async (params) => {
    // UPDATE appointment_reminders SET cancelled = true
    // Move deal para stage anterior ou "Cancelado"
    // Gera action item na Inbox
  },
}),

send_satisfaction_survey: tool({
  description: '[CLÍNICAS] Envia pesquisa de satisfação pós-consulta.',
  parameters: z.object({
    appointment_id: z.string().uuid(),
  }),
  execute: async (params) => {
    // Envia mensagem de pesquisa via WhatsApp
    // Marca satisfaction_survey_sent = true
  },
}),

record_satisfaction: tool({
  description: '[CLÍNICAS] Registra resposta da pesquisa de satisfação.',
  parameters: z.object({
    appointment_id: z.string().uuid(),
    score: z.number().min(1).max(5),
    feedback: z.string().optional(),
  }),
  execute: async (params) => {
    // UPDATE appointment_reminders
    // Se score <= 3: gera action item CRÍTICO
    // Registra como atividade no contato
  },
}),

// ── VISITAS (IMOBILIÁRIAS) ──
schedule_visit: tool({
  description: '[IMOBILIÁRIA] Agenda visita a um imóvel e ativa jornada de lembretes.',
  parameters: z.object({
    property_id: z.string().uuid(),
    visit_datetime: z.string().datetime(),
    visit_type: z.enum(['presencial', 'virtual', 'video_call']),
    broker_name: z.string().optional(),
  }),
  execute: async (params, { organizationId, conversationId, contactId, dealId }) => {
    // INSERT em property_journey
    // Busca dados do imóvel (vertical_properties)
    // Busca dados do bairro
    // Calcula lembretes
    // Move deal para stage "Visita Agendada"
  },
}),

collect_visit_feedback: tool({
  description: '[IMOBILIÁRIA] Coleta e registra feedback da visita ao imóvel.',
  parameters: z.object({
    journey_id: z.string().uuid(),
    score: z.number().min(1).max(5),
    feedback_text: z.string().optional(),
    objections: z.array(z.string()).optional(),
  }),
  execute: async (params) => {
    // UPDATE property_journey
    // Se score baixo: dispara property_match com filtros ajustados
    // Move deal para próximo stage
  },
}),

send_property_info: tool({
  description: '[IMOBILIÁRIA] Envia informações detalhadas de um imóvel ao cliente.',
  parameters: z.object({
    property_id: z.string().uuid(),
    include_neighborhood: z.boolean().default(true),
    include_route: z.boolean().default(false),
  }),
  execute: async (params) => {
    // Busca dados completos do imóvel + bairro
    // Formata mensagem rica com destaques
    // Envia via WhatsApp
  },
}),

manage_documentation: tool({
  description: '[IMOBILIÁRIA] Gerencia checklist de documentação pós-aceite de proposta.',
  parameters: z.object({
    journey_id: z.string().uuid(),
    document_name: z.string(),
    status: z.enum(['pendente', 'recebido', 'rejeitado']),
    rejection_reason: z.string().optional(),
  }),
  execute: async (params) => {
    // UPDATE property_journey.documentation_checklist
    // Se rejeitado: notifica cliente do problema
    // Se todos recebidos: gera action item de conclusão
  },
}),
```

---

## 4. Edge Functions Adicionais

### 4.1 Edge Function: agent-followup-executor

Executa os follow-ups agendados. Chamado por pg_cron a cada 5 minutos.

```typescript
// supabase/functions/agent-followup-executor/index.ts
// Fluxo:
// 1. SELECT followup_executions WHERE next_scheduled_at <= now() AND status = 'active'
// 2. Para cada execução:
//    a. Verificar stop conditions (lead respondeu? deal fechou?)
//    b. Verificar business hours (se configurado)
//    c. Verificar janela 24h do WhatsApp
//    d. Carregar step atual da sequência
//    e. Compor prompt com contexto vertical + dados do CRM
//    f. Gerar mensagem via IA (ou usar template se fora da janela)
//    g. Enviar via WhatsApp
//    h. Salvar mensagem em messages (role: 'ai')
//    i. Atualizar followup_execution: current_step++, next_scheduled_at, messages_sent++
//    j. Se último step: marcar como 'completed'
//    k. Log em ai_usage_logs (AI Governance)
```

### 4.2 Edge Function: agent-appointment-manager

Gerencia lembretes de consultas. Chamado por pg_cron a cada 15 minutos.

```typescript
// supabase/functions/agent-appointment-manager/index.ts
// Fluxo:
// 1. SELECT appointment_reminders WHERE attended IS NULL AND cancelled = false
// 2. Para cada reminder, verificar cada step do reminders_config:
//    a. Se days_before corresponde e sent = false:
//       - Gerar mensagem de lembrete via IA (contextualizada)
//       - Enviar via WhatsApp
//       - Marcar step como sent = true
// 3. Pós-consulta: se horário passou e attended IS NULL:
//    - Se attended = true e satisfaction_survey_sent = false:
//      - Aguardar 2-4h, enviar pesquisa de satisfação
//    - Se attended = false:
//      - Enviar mensagem de no-show
//      - Gerar action item na Inbox
//      - Ativar sequência de reagendamento
```

### 4.3 Edge Function: agent-visit-manager

Gerencia lembretes de visitas imobiliárias. Chamado por pg_cron a cada 15 minutos.

```typescript
// supabase/functions/agent-visit-manager/index.ts
// Fluxo similar ao appointment-manager adaptado para imobiliária:
// 1. SELECT property_journey WHERE visit_completed = false AND cancelled = false
// 2. Enviar informações pré-visita (2 dias antes)
// 3. Enviar lembretes (1 dia, no dia)
// 4. Pós-visita: coletar feedback
// 5. Se proposta aceita: iniciar checklist de documentação
// 6. Cobrar documentos pendentes periodicamente
```

### 4.4 pg_cron Jobs Adicionais

| Job | Schedule | Ação |
|---|---|---|
| `execute_followups` | `*/5 * * * *` | Executa `agent-followup-executor` — follow-ups vencidos |
| `manage_appointments` | `*/15 * * * *` | Executa `agent-appointment-manager` — lembretes de consultas |
| `manage_visits` | `*/15 * * * *` | Executa `agent-visit-manager` — lembretes de visitas |
| `activate_reactivation` | `0 8 * * 1` | Segundas 8h: busca pacientes/clientes inativos → ativa sequências de reativação |
| `activate_maintenance` | `0 9 1 * *` | Dia 1 de cada mês: busca pacientes odonto com manutenção vencida → ativa sequência |
| `activate_return_reminders` | `0 8 * * *` | Diário 8h: busca retornos médicos vencidos ou próximos → ativa lembretes |
| `cleanup_completed_followups` | `0 2 * * 0` | Domingos 2h: arquiva followup_executions concluídas > 30 dias |
| `detect_conversation_idle` | `*/10 * * * *` | A cada 10min: detecta conversas ativas sem resposta do lead → ativa quick follow-up |

---

## 5. Respeito à Janela de 24h do WhatsApp

### 5.1 Regras da Meta

- **Dentro da janela (24h desde última mensagem do lead):** Mensagens livres (texto, mídia, interativas)
- **Fora da janela:** Apenas Template Messages pré-aprovadas pela Meta
- **Conversas de serviço (user-initiated):** Gratuitas dentro da janela
- **Template messages:** Cobradas por mensagem (~$0.01-0.05 dependendo do país e categoria)

### 5.2 Comportamento do NossoAgent

```typescript
// lib/ai/followup-sender.ts
async function sendFollowupMessage(
  execution: FollowupExecution,
  step: FollowupStep,
  conversation: Conversation
): Promise<boolean> {
  const lastLeadMessage = await getLastLeadMessage(conversation.id);
  const hoursSinceLastLeadMsg = differenceInHours(new Date(), lastLeadMessage.created_at);
  const isWithin24hWindow = hoursSinceLastLeadMsg < 24;

  if (isWithin24hWindow) {
    // Dentro da janela: mensagem livre gerada por IA
    const message = await generateAIMessage(step.message_prompt, conversation);
    await sendWhatsAppMessage(conversation.whatsapp_number, message);
    return true;
  }

  // Fora da janela
  if (step.fallback_to_template && execution.sequence.template_message_id) {
    // Usar template message aprovado pela Meta
    await sendWhatsAppTemplate(
      conversation.whatsapp_number,
      execution.sequence.template_message_id,
      buildTemplateVariables(conversation)
    );
    return true;
  }

  if (step.create_inbox_item) {
    // Não pode enviar WhatsApp → gera action item para equipe
    await createInboxActionItem({
      title: `Follow-up manual necessário: ${conversation.whatsapp_name}`,
      description: `Janela de 24h expirada. Sugestão: ${step.message_prompt}`,
      priority: 'medium',
    });
    return false;
  }

  return false; // Pula step
}
```

### 5.3 Template Messages Recomendados por Vertical

Cada vertical deve ter templates pré-aprovados pela Meta para follow-ups fora da janela:

| Vertical | Template | Categoria Meta | Conteúdo |
|---|---|---|---|
| **Médica** | `clinic_appointment_reminder` | Utility | "Olá {{1}}! Lembramos que sua consulta com {{2}} está marcada para {{3}}. Confirme respondendo SIM." |
| **Médica** | `clinic_reactivation` | Marketing | "Olá {{1}}! Faz tempo que não nos vemos. Que tal agendar um check-up? Responda para agendar." |
| **Médica** | `clinic_satisfaction` | Utility | "Olá {{1}}! Como foi sua consulta com {{2}}? Avalie de 1 a 5 respondendo esta mensagem." |
| **Odonto** | `dental_budget_followup` | Marketing | "Olá {{1}}! Seu orçamento para {{2}} ainda está disponível. Condições especiais de parcelamento. Quer saber mais?" |
| **Odonto** | `dental_maintenance` | Utility | "Olá {{1}}! É hora da sua manutenção semestral. Responda para agendar." |
| **Odonto** | `dental_treatment_progress` | Utility | "Olá {{1}}! Seu tratamento de {{2}} está na sessão {{3}} de {{4}}. Quando agendamos a próxima?" |
| **Imobiliária** | `realestate_new_property` | Marketing | "Olá {{1}}! Novos imóveis na região de {{2}}. Quer ver as opções? Responda SIM." |
| **Imobiliária** | `realestate_visit_reminder` | Utility | "Olá {{1}}! Sua visita está marcada para {{2}}. Endereço: {{3}}. Confirme respondendo SIM." |
| **Imobiliária** | `realestate_documents` | Utility | "Olá {{1}}! Documentos pendentes para seu imóvel: {{2}}. Envie por aqui para agilizar!" |
| **Genérico** | `generic_followup` | Marketing | "Olá {{1}}! Estávamos conversando sobre {{2}}. Posso ajudar com mais alguma coisa?" |

---

## 6. Configuração de Follow-ups (UI)

### 6.1 Nova Tab na Configuração do Agente: "Follow-ups & Nurturing"

Adiciona tab ao `/configuracoes/agente` existente:

#### Seção 1: Sequências Ativas

Lista de todas as sequências de follow-up com toggle on/off. Cada sequência exibe: nome, tipo, vertical, quantidade de steps, conversas ativas nesta sequência.

#### Seção 2: Editor de Sequência

Ao clicar em uma sequência, abre editor visual:

- **Trigger:** Condição de ativação (dropdown + configuração)
- **Steps:** Timeline visual com cards para cada step
  - Delay (minutos/horas/dias)
  - Prompt para a IA (textarea)
  - Condição de execução (opcional)
  - Canal (WhatsApp / WhatsApp Template)
  - Toggle: criar action item na Inbox
- **Stop conditions:** Checkboxes (lead respondeu, deal fechado, deal perdido, opt-out)
- **Rate limiting:** Max msgs/dia, respeitar horário comercial, intervalo mínimo entre msgs

#### Seção 3: Jornada de Consulta (visível apenas para Clínicas)

- **Lembretes:** Toggle on/off para cada momento (7d, 2d, 1d, no dia)
- **Instruções de preparo:** Editor de templates por tipo de procedimento
- **Documentos necessários:** Lista editável por tipo de consulta
- **Pesquisa de satisfação:** Toggle + delay após consulta (horas)
- **Pós-consulta:** Template de orientações pós-procedimento
- **Retorno:** Toggle automático + intervalo padrão

#### Seção 4: Jornada de Visita (visível apenas para Imobiliárias)

- **Lembretes:** Toggle on/off para cada momento (2d, 1d, no dia)
- **Informações pré-visita:** Toggle enviar destaques + informações de bairro
- **Feedback pós-visita:** Toggle + delay
- **Checklist de documentação:** Lista editável por tipo de transação (venda vs locação)

#### Seção 5: Métricas de Follow-up

Dashboard inline com:
- Follow-ups ativos / concluídos / cancelados (por tipo)
- Taxa de resposta por tipo de sequência
- Taxa de conversão pós-follow-up
- Mensagens enviadas / custo de IA
- Sequências com melhor performance
- Taxa de confirmação de consultas (clínicas)
- Taxa de feedback coletado (imobiliárias)

---

## 7. Integração com Inbox Inteligente 2.0

Os follow-ups geram action items na Inbox **existente** automaticamente:

| Evento | Action Item | Prioridade |
|---|---|---|
| Follow-up atingiu último step sem resposta | "Lead não respondeu sequência completa: [nome]" | High |
| Paciente não confirmou consulta (1d antes) | "URGENTE: Paciente [nome] não confirmou consulta de amanhã" | Critical |
| Paciente deu no-show | "No-show: [nome] — [procedimento] com Dr. [médico]" | Critical |
| Satisfação <= 3 estrelas | "Alerta qualidade: [nome] avaliou com nota [X]" | Critical |
| Reativação sem resposta após 5 tentativas | "Paciente/cliente [nome] não responde — considerar desativação" | Medium |
| Documento pendente > 7 dias (imobiliária) | "Documentação pendente: [nome] — [documento faltante]" | High |
| Tratamento abandonado > 15 dias (odonto) | "ABANDONO: [nome] — tratamento [tipo] parado sessão [X/Y]" | Critical |
| Manutenção vencida > 2 meses (odonto) | "Manutenção atrasada: [nome] — última há [X] meses" | Medium |
| Visita sem feedback > 48h (imobiliária) | "Feedback pendente: [nome] — visita em [imóvel]" | Medium |

---

## 8. Migrations Adicionais

| # | Migration | Descrição |
|---|---|---|
| 7 | `create_followup_sequences` | Tabela `followup_sequences` + RLS + índices |
| 8 | `create_followup_executions` | Tabela `followup_executions` + RLS + índices |
| 9 | `create_appointment_reminders` | Tabela `appointment_reminders` + RLS + índices |
| 10 | `create_property_journey` | Tabela `property_journey` + RLS + índices |
| 11 | `seed_followup_sequences` | INSERT das sequências padrão por vertical (todas as cadências deste PRD) |
| 12 | `setup_followup_cron_jobs` | pg_cron: followup executor, appointment/visit managers, reactivation, maintenance, cleanup |

*Numeração continua de onde o PRD principal parou (6 migrations).*

---

## 9. Plano de Implementação — Fases Adicionais

Estas fases se integram ao plano principal do PRD NossoAgent. Podem ser executadas em paralelo com as fases 5-8.

| Fase | Escopo | Duração Est. | Dependências |
|---|---|---|---|
| **A — Infraestrutura Follow-up** | Tabelas (followup_sequences, followup_executions), migrations, RLS, seed das sequências padrão | 1 semana | PRD Principal Fases 1-3 |
| **B — Follow-up Engine** | Edge Function agent-followup-executor, lógica de janela 24h, integração AI Governance, stop conditions | 1.5 semanas | Fase A |
| **C — Jornada Clínica** | Tabela appointment_reminders, Edge Function agent-appointment-manager, tools (schedule/reschedule/cancel appointment, satisfaction), pg_cron | 2 semanas | Fases A-B |
| **D — Jornada Imobiliária** | Tabela property_journey, Edge Function agent-visit-manager, tools (schedule_visit, collect_feedback, send_property_info, manage_documentation), pg_cron | 1.5 semanas | Fases A-B |
| **E — UI de Configuração** | Tab "Follow-ups & Nurturing" no /configuracoes/agente, editor de sequências, métricas | 1.5 semanas | Fases A-B |
| **F — Templates WhatsApp** | Integração com Template Messages da Meta, submissão e aprovação de templates, lógica de fallback | 1 semana | Fases B-D |
| **G — Polish + QA** | Testes E2E de fluxos completos, edge cases de timing, performance de pg_cron, documentação | 1 semana | Todas |

**Estimativa total das fases adicionais:** ~9.5 semanas (~2.5 meses)

**Estimativa total combinada (PRD Principal + Addendum):** ~15-17 semanas (~4 meses) para entrega completa com todas as funcionalidades.

---

## 10. Métricas de Sucesso Adicionais

| Métrica | Meta | Como Medir |
|---|---|---|
| Taxa de resposta a follow-ups | > 25% | Leads que responderam / follow-ups enviados |
| Taxa de reativação | > 10% | Pacientes/clientes reativados / total de inativos contactados |
| Redução de no-show (clínicas) | -40% | Comparar taxa de absenteísmo antes/depois dos lembretes |
| Taxa de confirmação de consulta | > 85% | Consultas confirmadas via agente / total agendadas |
| CSAT médio (pesquisa) | > 4.2/5.0 | Média dos scores de satisfação coletados |
| Taxa de coleta de feedback (imob) | > 70% | Feedbacks coletados / visitas realizadas |
| Conversão remarketing → deal | > 5% | Deals criados a partir de leads em remarketing |
| Documentação completa < 7 dias | > 60% | Checklists completos em 7 dias / total |
| Custo por follow-up | < R$0.10 | Custo IA + WhatsApp por mensagem de follow-up |

---

## 11. Riscos e Mitigações Adicionais

| Risco | Severidade | Mitigação |
|---|---|---|
| Excesso de mensagens percebido como spam | Alta | Rate limiting rigoroso (max 2 msgs/dia). Respeito a horário comercial. Stop automático se lead não responde após sequência completa. Opt-out fácil em toda mensagem. |
| Bloqueio do número pelo WhatsApp | Alta | Limitar a 3 mensagens consecutivas sem resposta. Usar template messages aprovados. Monitorar quality rating do número no Meta Business Manager. Pausa automática se quality cai. |
| Mensagens de IA inapropriadas em contexto sensível | Alta | System prompts rigorosos por vertical. Proibição de dados clínicos em mensagens. Review periódico de mensagens geradas. Fallback para templates em casos sensíveis. |
| Custo elevado com volume alto de follow-ups | Média | Modelo Haiku para follow-ups simples (menor custo). Templates para mensagens repetitivas. Cache de mensagens comuns. AI Governance com quota específica para follow-ups. |
| Conflito entre follow-up automático e atendimento humano | Média | Stop condition: qualquer follow-up cancela se conversation.status muda para 'human_active'. Notificação visual no dashboard quando follow-up está ativo. |
| Paciente/cliente já está em outra sequência | Média | Regra: máximo 1 sequência ativa por conversa. Nova sequência cancela anterior. Prioridade: quick > warm > pipeline > remarketing > reactivation. |
| Timing incorreto de lembretes (fuso horário) | Baixa | Todos os cálculos usam timezone da organização (agent_configs.timezone). Lembretes agendados em UTC mas verificados contra horário local. |
| LGPD: dados em mensagens de follow-up | Média | Nunca incluir dados clínicos, diagnósticos ou resultados em mensagens. Apenas referências genéricas ao tipo de atendimento. Consentimento de comunicação registrado. |

---

## 12. Feature Flags Adicionais

| Feature Flag | Descrição | Default |
|---|---|---|
| `agent_followup_quick` | Habilita quick follow-ups (30min-24h) | true |
| `agent_followup_warm` | Habilita warm follow-ups (1-3 dias) | true |
| `agent_followup_pipeline` | Habilita pipeline follow-ups (3-14 dias) | true |
| `agent_followup_remarketing` | Habilita remarketing/nurturing (15-90 dias) | false |
| `agent_followup_reactivation` | Habilita reativação (3-12+ meses) | false |
| `agent_appointment_journey` | Habilita jornada completa de consulta (clínicas) | true |
| `agent_satisfaction_survey` | Habilita pesquisa de satisfação pós-consulta | true |
| `agent_visit_journey` | Habilita jornada completa de visita (imobiliárias) | true |
| `agent_documentation_manager` | Habilita gestão de documentação (imobiliárias) | true |
| `agent_whatsapp_templates` | Habilita uso de template messages fora da janela 24h | false |

---

*NossoCRM — PRD Addendum: NossoAgent Follow-ups, Nurturing & Jornada do Cliente v1.0*
*IntelliX.AI — Documento gerado em 24 de Fevereiro de 2026*
*Baseado em pesquisa de melhores práticas de mercado: ADA, BoomTown, Luxury Presence, Demandforce, Prospyr, RevenueWell (2024-2025).*
