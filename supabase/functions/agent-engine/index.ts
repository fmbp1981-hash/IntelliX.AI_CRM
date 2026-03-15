// supabase/functions/agent-engine/index.ts
// The core AI engine — processes incoming messages, generates responses via tool-calling
// Called internally by agent-webhook. Requires JWT (service role).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

// ============================================
// Types
// ============================================

interface EngineRequest {
    organization_id: string;
    whatsapp_number: string;
    whatsapp_name: string | null;
    message_content: string;
    content_type: string;
    media_url: string | null;
    whatsapp_message_id: string;
    whatsapp_timestamp: string;
}

interface AgentConfig {
    id: string;
    organization_id: string;
    is_active: boolean;
    whatsapp_provider: string;
    whatsapp_config: Record<string, any>;
    agent_name: string;
    welcome_message: string | null;
    transfer_message: string;
    outside_hours_message: string;
    business_hours: Record<string, { start: string | null; end: string | null; active: boolean }>;
    timezone: string;
    attend_outside_hours: boolean;
    ai_model: string;
    ai_temperature: number;
    max_tokens_per_response: number;
    system_prompt_override: string | null;
    qualification_fields: Array<{ key: string; question: string; required: boolean }>;
    auto_create_contact: boolean;
    auto_create_deal: boolean;
    default_board_id: string | null;
    default_stage_id: string | null;
    transfer_rules: Array<{ condition: string; transfer_to: string; message: string }>;
    max_messages_before_transfer: number | null;
    business_profile: Record<string, any>;
}

interface Conversation {
    id: string;
    organization_id: string;
    whatsapp_number: string;
    status: string;
    assigned_agent: string;
    contact_id: string | null;
    deal_id: string | null;
    qualification_data: Record<string, any>;
    qualification_status: string;
    summary: string | null;
    detected_intent: string | null;
}

interface Message {
    id: string;
    role: string;
    content: string;
    created_at: string;
    ai_tools_used: string[];
}

// ============================================
// Helper: Business hours check
// ============================================

function isWithinBusinessHours(config: AgentConfig): boolean {
    const now = new Date();

    // Convert to org timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: config.timezone,
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const weekday = parts.find((p) => p.type === 'weekday')?.value?.toLowerCase();
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const minute = parts.find((p) => p.type === 'minute')?.value;

    if (!weekday || !hour || !minute) return true;

    const daySchedule = config.business_hours[weekday];
    if (!daySchedule || !daySchedule.active || !daySchedule.start || !daySchedule.end) {
        return false;
    }

    const currentTime = `${hour}:${minute}`;
    return currentTime >= daySchedule.start && currentTime <= daySchedule.end;
}

// ============================================
// Helper: Find or create conversation
// ============================================

async function findOrCreateConversation(
    supabase: SupabaseClient,
    orgId: string,
    whatsappNumber: string,
    whatsappName: string | null
): Promise<Conversation> {
    // Look for an existing active conversation
    const { data: existing } = await supabase
        .from('conversations')
        .select('*')
        .eq('organization_id', orgId)
        .eq('whatsapp_number', whatsappNumber)
        .in('status', ['active', 'waiting_human', 'human_active', 'processing_response']) // Added processing state
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (existing) return existing as Conversation;

    // Create new conversation
    const { data: created, error } = await supabase
        .from('conversations')
        .insert({
            organization_id: orgId,
            whatsapp_number: whatsappNumber,
            whatsapp_name: whatsappName,
            status: 'active',
            assigned_agent: 'ai',
            last_message_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create conversation: ${error.message}`);

    // Create Action Item for the new lead
    await supabase.from('inbox_action_items').insert({
        organization_id: orgId,
        type: 'follow_up',
        priority: 'medium',
        title: `Novo Lead via WhatsApp`,
        description: `Nome: ${whatsappName || whatsappNumber}\nTelefone: ${whatsappNumber}`,
        status: 'pending',
    });

    return created as Conversation;
}

// ============================================
// Helper: Save message
// ============================================

async function saveMessage(
    supabase: SupabaseClient,
    conversationId: string,
    orgId: string,
    msg: {
        role: string;
        content: string;
        content_type?: string;
        whatsapp_message_id?: string;
        ai_model?: string;
        ai_tokens_input?: number;
        ai_tokens_output?: number;
        ai_tools_used?: string[];
        ai_reasoning?: string;
    }
): Promise<Message> {
    const { data, error } = await supabase
        .from('messages')
        .insert({
            conversation_id: conversationId,
            organization_id: orgId,
            role: msg.role,
            content: msg.content,
            content_type: msg.content_type ?? 'text',
            whatsapp_message_id: msg.whatsapp_message_id,
            ai_model: msg.ai_model,
            ai_tokens_input: msg.ai_tokens_input,
            ai_tokens_output: msg.ai_tokens_output,
            ai_tools_used: msg.ai_tools_used ?? [],
            ai_reasoning: msg.ai_reasoning,
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to save message: ${error.message}`);

    // Update conversation last_message_at
    await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

    return data as Message;
}

// ============================================
// Helper: Get conversation history
// ============================================

async function getConversationHistory(
    supabase: SupabaseClient,
    conversationId: string,
    limit: number = 20
): Promise<Message[]> {
    const { data } = await supabase
        .from('messages')
        .select('id, role, content, created_at, ai_tools_used')
        .eq('conversation_id', conversationId)
        .eq('is_internal_note', false)
        .order('created_at', { ascending: true })
        .limit(limit);

    return (data ?? []) as Message[];
}

// ============================================
// Phase 5: Methodology Resolution (stage > board > global)
// ============================================

interface ResolvedMethodology {
    base_prompt: string | null;       // From stage/board override or template
    agent_role: string;               // e.g. "closer", "sdr", "generic"
    methodology_guide: string | null; // Inline methodology instructions
    tone_section: string | null;      // From agent_configs.tone_of_voice
    business_context: string | null;  // From agent_configs.business_context_extended
    behavioral_training: string | null; // From agent_configs.behavioral_training
    qualification_criteria: Record<string, unknown>; // Stage-specific criteria
}

async function resolveMethodology(
    supabase: SupabaseClient,
    orgId: string,
    stageId: string | null,
    boardId: string | null
): Promise<ResolvedMethodology> {
    // 1. Try agent_stage_configs (highest priority)
    if (stageId) {
        const { data: stageCfg } = await supabase
            .from('agent_stage_configs')
            .select('*')
            .eq('organization_id', orgId)
            .eq('stage_id', stageId)
            .single();

        if (stageCfg?.system_prompt_override) {
            const personalization = await loadPersonalization(supabase, orgId);
            return {
                base_prompt: stageCfg.system_prompt_override,
                agent_role: stageCfg.agent_role ?? 'generic',
                methodology_guide: null, // override takes full control
                ...personalization,
                qualification_criteria: stageCfg.qualification_criteria ?? {},
            };
        }
    }

    // 2. Try agent_board_configs
    if (boardId) {
        const { data: boardCfg } = await supabase
            .from('agent_board_configs')
            .select('*')
            .eq('organization_id', orgId)
            .eq('board_id', boardId)
            .single();

        if (boardCfg?.system_prompt_override) {
            const personalization = await loadPersonalization(supabase, orgId);
            return {
                base_prompt: boardCfg.system_prompt_override,
                agent_role: boardCfg.agent_role ?? 'generic',
                methodology_guide: null,
                ...personalization,
                qualification_criteria: {},
            };
        }

        // 2b. Board has a methodology template
        if (boardCfg?.methodology_template_id) {
            const { data: template } = await supabase
                .from('agent_methodology_templates')
                .select('*')
                .eq('id', boardCfg.methodology_template_id)
                .single();

            if (template) {
                const personalization = await loadPersonalization(supabase, orgId);
                return {
                    base_prompt: template.system_prompt,
                    agent_role: template.agent_role ?? 'generic',
                    methodology_guide: buildMethodologyGuide(template.methodology),
                    ...personalization,
                    qualification_criteria: {},
                };
            }
        }
    }

    // 3. Fall back to global agent_configs personalization
    const personalization = await loadPersonalization(supabase, orgId);
    return {
        base_prompt: null, // will use legacy config.system_prompt_override
        agent_role: 'generic',
        methodology_guide: buildMethodologyGuide(
            (personalization.sales_methodology_primary as string | undefined) ?? 'bant'
        ),
        ...personalization,
        qualification_criteria: {},
    };
}

async function loadPersonalization(supabase: SupabaseClient, orgId: string): Promise<{
    tone_section: string | null;
    business_context: string | null;
    behavioral_training: string | null;
    sales_methodology_primary?: string;
}> {
    const { data } = await supabase
        .from('agent_configs')
        .select('tone_of_voice, business_context_extended, behavioral_training, sales_methodology')
        .eq('organization_id', orgId)
        .single();

    if (!data) return { tone_section: null, business_context: null, behavioral_training: null };

    return {
        tone_section: buildToneSection(data.tone_of_voice),
        business_context: buildBusinessContextSection(data.business_context_extended),
        behavioral_training: buildBehavioralSection(data.behavioral_training),
        sales_methodology_primary: (data.sales_methodology as any)?.primary,
    };
}

function buildMethodologyGuide(methodology: string): string | null {
    const guides: Record<string, string> = {
        bant: `## METODOLOGIA: BANT\nQualifique: Budget (orçamento disponível?) → Authority (é o decisor?) → Need (qual a dor real?) → Timeline (qual o prazo?). Leads sem Budget + Authority → nurturing.`,
        spin: `## METODOLOGIA: SPIN Selling\nConduz por 4 perguntas: Situação (contexto atual) → Problema (dores latentes) → Implicação (custo de não resolver) → Necessidade de Solução (lead verbaliza o benefício desejado). O lead que verbaliza a necessidade está pronto para a proposta.`,
        meddic: `## METODOLOGIA: MEDDIC\nMapeie: Metrics (ROI esperado) → Economic Buyer (quem aprova?) → Decision Criteria (critérios de escolha) → Decision Process (como compram?) → Identify Pain (dor crítica) → Champion (defensor interno?).`,
        gpct: `## METODOLOGIA: GPCT\nAlinhe: Goals (metas numéricas) → Plans (estratégias tentadas) → Challenges (o que impede) → Timeline (quando precisam dos resultados). Só avance se a solução se encaixa nas metas declaradas.`,
        flavio_augusto: `## METODOLOGIA: Flávio Augusto (Wiser)\nPrincípios: CAC Zero (reative antes de buscar novos) → Enriquecimento mútuo (venda só é boa se for boa pro cliente) → Timing (leads que disseram não antes podem dizer sim hoje) → Velocidade de execução → Referências (todo cliente satisfeito gera novos clientes).`,
        neurovendas: `## METODOLOGIA: Neurovendas\nVenda para o cérebro reptiliano: Contraste (antes/depois vívido) → Abertura/Fechamento impactantes → Imagens mentais e metáforas → Prova social → Urgência real → Espelhe a linguagem do lead para rapport subliminar.`,
        consultivo: `## METODOLOGIA: Venda Consultiva\nPositione-se como especialista: mais perguntas que afirmações → entenda profundamente antes de propor → apresente solução como consequência lógica das necessidades levantadas → seja honesto se a solução não for ideal.`,
        hybrid: `## METODOLOGIA: Híbrida\nTopo: SPIN (revelar necessidade) → Meio: BANT + Flávio Augusto (qualificação + timing) → Fundo: Neurovendas (ativação de decisão).`,
    };
    return guides[methodology] ?? null;
}

function buildToneSection(toneData: any): string | null {
    if (!toneData) return null;
    const parts: string[] = [`\n## TOM DE VOZ: ${toneData.preset ?? 'profissional'}`];
    const ls = toneData.language_style;
    if (ls) {
        const attrs = [
            ls.formality && `formalidade: ${ls.formality}`,
            ls.energy && `energia: ${ls.energy}`,
            ls.empathy_level && `empatia: ${ls.empathy_level}`,
            ls.use_emojis !== undefined && `emojis: ${ls.use_emojis ? 'sim (com moderação)' : 'não usar'}`,
        ].filter(Boolean);
        if (attrs.length) parts.push(`Estilo: ${attrs.join(' | ')}`);
    }
    if (toneData.words_to_use?.length) {
        parts.push(`Palavras recomendadas: ${toneData.words_to_use.slice(0, 8).join(', ')}`);
    }
    if (toneData.words_to_avoid?.length) {
        parts.push(`Palavras PROIBIDAS: ${toneData.words_to_avoid.slice(0, 8).join(', ')}`);
    }
    if (toneData.few_shot_examples?.length) {
        parts.push('\nExemplos de tom:');
        toneData.few_shot_examples.slice(0, 2).forEach((ex: any) => {
            parts.push(`Lead: "${ex.user_message}"\nAgente: "${ex.agent_response}"`);
        });
    }
    return parts.join('\n');
}

function buildBusinessContextSection(ctx: any): string | null {
    if (!ctx) return null;
    const parts: string[] = ['\n## CONTEXTO DO NEGÓCIO'];
    if (ctx.key_products_services?.length) {
        parts.push('Produtos/Serviços:');
        ctx.key_products_services.slice(0, 4).forEach((p: any) => {
            parts.push(`- ${p.name}${p.price_range ? ` (${p.price_range})` : ''}: ${p.description}`);
        });
    }
    if (ctx.unique_value_propositions?.length) {
        parts.push(`Diferenciais: ${ctx.unique_value_propositions.join(' | ')}`);
    }
    if (ctx.important_rules?.length) {
        parts.push('Regras importantes:');
        ctx.important_rules.forEach((r: string) => parts.push(`- ⚠️ ${r}`));
    }
    return parts.join('\n');
}

function buildBehavioralSection(bt: any): string | null {
    if (!bt) return null;
    const parts: string[] = ['\n## DIRETRIZES COMPORTAMENTAIS'];
    if (bt.do_list?.length) {
        parts.push('SEMPRE: ' + bt.do_list.slice(0, 5).map((x: string) => `✅ ${x}`).join(' | '));
    }
    if (bt.dont_list?.length) {
        parts.push('NUNCA: ' + bt.dont_list.slice(0, 5).map((x: string) => `❌ ${x}`).join(' | '));
    }
    if (bt.escalation_triggers?.length) {
        parts.push('Transferir para humano se: ' + bt.escalation_triggers.slice(0, 4).join(' | '));
    }
    return parts.join('\n');
}

// ============================================
// Helper: Compose system prompt (Phase 5 enhanced)
// ============================================

async function composeSystemPrompt(
    supabase: SupabaseClient,
    orgId: string,
    config: AgentConfig,
    conversation: Conversation,
    knowledgeContext: string | null,
    resolved: ResolvedMethodology
): Promise<string> {
    const parts: string[] = [];

    // 1. Base prompt — resolved hierarchy wins over legacy override
    const basePrompt = resolved.base_prompt ?? config.system_prompt_override;

    if (basePrompt) {
        parts.push(basePrompt);
    } else {
        // Fallback base identity
        parts.push(`Você é ${config.agent_name}, o assistente de atendimento inteligente.

## REGRAS DE OURO
1. NUNCA invente informações. Se não sabe, diga que vai verificar ou transfira para um humano.
2. NUNCA prometa preços, prazos ou condições sem dados concretos do CRM.
3. SEMPRE colete as informações de qualificação antes de avançar.
4. Use ferramentas (tools) proativamente: crie contatos, mova deals, registre atividades.
5. Se o lead pedir algo que você não pode resolver, transfira para um humano.
6. Respostas concisas (máximo 3 parágrafos). WhatsApp não é email.
7. Emojis com moderação — 1-2 por mensagem.
8. Responda em português brasileiro.`);
    }

    // 2. Methodology guide (from resolved config)
    if (resolved.methodology_guide) {
        parts.push(resolved.methodology_guide);
    }

    // 3. Tone of voice
    if (resolved.tone_section) {
        parts.push(resolved.tone_section);
    }

    // 4. Business context (products, UVPs, rules)
    if (resolved.business_context) {
        parts.push(resolved.business_context);
    }

    // 5. Behavioral training (do/don't/escalation)
    if (resolved.behavioral_training) {
        parts.push(resolved.behavioral_training);
    }

    // 6. Vertical context
    const { data: orgData } = await supabase
        .from('organizations')
        .select('business_type')
        .eq('id', orgId)
        .single();

    if (orgData?.business_type && orgData.business_type !== 'generic') {
        const { data: verticalConfig } = await supabase
            .from('vertical_configs')
            .select('ai_context')
            .eq('business_type', orgData.business_type)
            .single();

        if (verticalConfig?.ai_context) {
            parts.push(`\n## CONTEXTO DA VERTICAL\n${JSON.stringify(verticalConfig.ai_context)}`);
        }
    }

    // 7. Legacy business profile (backwards compat)
    if (!resolved.business_context && config.business_profile && Object.keys(config.business_profile).length > 0) {
        const { buildBusinessProfilePrompt } = await import('../../../lib/ai/business-profile-prompt.ts');
        const businessPrompt = buildBusinessProfilePrompt(config.business_profile);
        if (businessPrompt) {
            parts.push(businessPrompt);
        }
    }

    // 8. Knowledge Base (RAG)
    if (knowledgeContext) {
        parts.push(`\n## BASE DE CONHECIMENTO\nUse as informações abaixo para responder (se relevante):\n${knowledgeContext}`);
    }

    // 9. Stage-specific qualification criteria (if any)
    if (Object.keys(resolved.qualification_criteria).length > 0) {
        const criteria = Object.entries(resolved.qualification_criteria)
            .map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`)
            .join('\n');
        parts.push(`\n## CRITÉRIOS DESTE ESTÁGIO\n${criteria}`);
    }

    // 10. Qualification context (from config)
    if (config.qualification_fields.length > 0) {
        const collected = conversation.qualification_data ?? {};
        const pending = config.qualification_fields.filter((f) => !collected[f.key]);

        if (pending.length > 0) {
            parts.push(`\n## QUALIFICAÇÃO PENDENTE\nColete os seguintes campos naturalmente durante a conversa:\n${pending.map((f) => `- ${f.key}: "${f.question}" ${f.required ? '(obrigatório)' : '(opcional)'}`).join('\n')}`);
        } else {
            parts.push('\n## QUALIFICAÇÃO\nTodos os campos de qualificação já foram coletados. ✅');
        }
    }

    // 11. Entity context (linked contact/deal)
    if (conversation.contact_id) {
        const { data: contact } = await supabase
            .from('contacts')
            .select('name, email, phone, company_name')
            .eq('id', conversation.contact_id)
            .single();

        if (contact) {
            parts.push(`\n## CONTATO VINCULADO\nNome: ${contact.name}\nEmail: ${contact.email ?? 'N/A'}\nTelefone: ${contact.phone ?? 'N/A'}\nEmpresa: ${contact.company_name ?? 'N/A'}`);
        }
    }

    if (conversation.deal_id) {
        const { data: deal } = await supabase
            .from('deals')
            .select('title, value, stage_id')
            .eq('id', conversation.deal_id)
            .single();

        if (deal) {
            parts.push(`\n## DEAL VINCULADO\nTítulo: ${deal.title}\nValor: R$ ${deal.value ?? 'N/A'}`);
        }
    }

    // 12. Agent role footer
    if (resolved.agent_role && resolved.agent_role !== 'generic') {
        parts.push(`\n---\n*Papel neste pipeline: **${resolved.agent_role}***`);
    }

    // 13. Conversation summary
    if (conversation.summary) {
        parts.push(`\n## RESUMO DA CONVERSA ATÉ AQUI\n${conversation.summary}`);
    }

    return parts.join('\n\n').trim();
}

// ============================================
// Helper: Get Knowledge Base Context (RAG)
// ============================================

async function getKnowledgeContext(
    supabase: SupabaseClient,
    orgId: string,
    messageContent: string
): Promise<string | null> {
    try {
        const { OpenAI } = await import('https://esm.sh/openai@4');
        const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

        const embeddingRes = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: messageContent,
            dimensions: 1536,
        });

        const query_embedding = embeddingRes.data[0].embedding;

        // Use RPC 'match_documents'
        const { data: documents, error } = await supabase.rpc('match_documents', {
            query_embedding,
            match_threshold: 0.7, // Only reasonably relevant docs
            match_count: 3,
            p_organization_id: orgId
        });

        if (error || !documents || documents.length === 0) return null;

        return documents.map((d: any) => `[ID: ${d.id}]\nTítulo: ${d.title}\nConteúdo: ${d.content}`).join('\n\n');
    } catch (err) {
        console.error('RAG Error:', err);
        return null;
    }
}

// ============================================
// Helper: Send WhatsApp message via agent-send-message
// ============================================

async function sendWhatsAppMessage(
    config: AgentConfig,
    to: string,
    message: string
): Promise<void> {
    try {
        await fetch(`${SUPABASE_URL}/functions/v1/agent-send-message`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to,
                message,
                provider: config.whatsapp_provider,
                config: config.whatsapp_config,
            }),
        });
    } catch (err) {
        console.error('Failed to send WhatsApp message:', err);
    }
}

// ============================================
// Helper: Log AI usage (governance)
// ============================================

async function logAiUsage(
    supabase: SupabaseClient,
    params: {
        organization_id: string;
        action: string;
        model: string;
        tokens_input: number;
        tokens_output: number;
    }
): Promise<void> {
    try {
        await supabase.from('ai_usage_logs').insert({
            organization_id: params.organization_id,
            action: params.action,
            model: params.model,
            tokens_input: params.tokens_input,
            tokens_output: params.tokens_output,
            created_at: new Date().toISOString(),
        });

        // Increment quota
        await supabase.rpc('increment_ai_quota_usage', {
            p_organization_id: params.organization_id,
            p_tokens: params.tokens_input + params.tokens_output,
        });
    } catch (err) {
        console.error('Failed to log AI usage:', err);
    }
}

// ============================================
// Helper: Check AI quota
// ============================================

async function checkAiQuota(
    supabase: SupabaseClient,
    orgId: string
): Promise<boolean> {
    const { data } = await supabase
        .from('ai_quotas')
        .select('monthly_limit, current_usage')
        .eq('organization_id', orgId)
        .single();

    if (!data) return true;
    return data.current_usage < data.monthly_limit;
}

// ============================================
// Helper: Post-processing
// ============================================

async function postProcess(
    supabase: SupabaseClient,
    config: AgentConfig,
    conversation: Conversation,
    history: Message[],
    aiResponse: string
): Promise<void> {
    const totalMessages = history.length + 1;
    // Update summary every 5 messages to save tokens but keep context fresh
    if (totalMessages > 0 && totalMessages % 5 === 0) {
        try {
            const { generateText } = await import('https://esm.sh/ai@4');
            const { createAnthropic } = await import('https://esm.sh/@ai-sdk/anthropic@1');
            const anthropic = createAnthropic({
                apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
            });

            const chatText = history
                .map(m => `${m.role === 'lead' ? 'Cliente' : 'Agente'}: ${m.content}`)
                .join('\n') + `\nAgente: ${aiResponse}`;

            const summaryPrompt = `Você é um assistente de IA focado em resumir conversas de CRM (WhatsApp).
Resuma a conversa abaixo de forma EXTREMAMENTE CONCISA, focando no objetivo do cliente, dados importantes coletados e no ponto atual do atendimento.
MÁXIMO 3 FRASES. Direto ao ponto.

Conversa:
${chatText}`;

            const result = await generateText({
                model: anthropic(config.ai_model || 'claude-3-haiku-20240307'),
                prompt: summaryPrompt,
                temperature: 0.2, // low temp for factual summary
                maxTokens: 200,
            });

            await supabase
                .from('conversations')
                .update({ summary: result.text })
                .eq('id', conversation.id);
        } catch (err) {
            console.error('Failed to generate summary:', err);
        }
    }
}

// ============================================
// Helper: Track performance metrics (Aprender mode foundation)
// ============================================

async function trackConversationMetric(
    supabase: SupabaseClient,
    orgId: string,
    boardId: string | null,
    stageId: string | null,
    methodologyUsed: string,
    messageCount: number
): Promise<void> {
    try {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const periodStart = today;
        const periodEnd = today;

        // Upsert daily metric — increment conversation count
        const { data: existing } = await supabase
            .from('agent_performance_metrics')
            .select('id, conversations_total, avg_messages_to_conversion')
            .eq('organization_id', orgId)
            .eq('period_start', periodStart)
            .eq('period_end', periodEnd)
            .eq('board_id', boardId ?? null)
            .maybeSingle();

        if (existing) {
            const newTotal = (existing.conversations_total ?? 0) + 1;
            const prevAvg = existing.avg_messages_to_conversion ?? 0;
            const newAvg = Math.round((prevAvg * (newTotal - 1) + messageCount) / newTotal);

            await supabase
                .from('agent_performance_metrics')
                .update({
                    conversations_total: newTotal,
                    avg_messages_to_conversion: newAvg,
                    methodology_used: methodologyUsed,
                })
                .eq('id', existing.id);
        } else {
            await supabase.from('agent_performance_metrics').insert({
                organization_id: orgId,
                board_id: boardId,
                stage_id: stageId,
                period_start: periodStart,
                period_end: periodEnd,
                conversations_total: 1,
                avg_messages_to_conversion: messageCount,
                methodology_used: methodologyUsed,
            });
        }
    } catch (err) {
        // Non-critical — never throw
        console.error('Failed to track performance metric:', err);
    }
}

// ============================================
// Main Engine
// ============================================

serve(async (req: Request) => {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const payload: EngineRequest = await req.json();
        const {
            organization_id,
            whatsapp_number,
            whatsapp_name,
            message_content,
            content_type,
            media_url,
            whatsapp_message_id,
        } = payload;

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // ── Step 1: Find or create conversation ──
        const conversation = await findOrCreateConversation(
            supabase,
            organization_id,
            whatsapp_number,
            whatsapp_name
        );

        // ── Step 2: Concurrency & Status Checks ──
        if (conversation.status === 'human_active') {
            await saveMessage(supabase, conversation.id, organization_id, {
                role: 'lead',
                content: message_content,
                content_type,
                whatsapp_message_id,
            });
            return new Response(JSON.stringify({ status: 'human_active' }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (conversation.status === 'processing_response') {
            console.log('Skipping message - AI is currently processing a response for this conversation');
            return new Response(JSON.stringify({ status: 'ignored_double_request' }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Lock conversation immediately
        await supabase
            .from('conversations')
            .update({ status: 'processing_response' })
            .eq('id', conversation.id);

        // ── Step 3: Get agent config ──
        const { data: agentConfig } = await supabase
            .from('agent_configs')
            .select('*')
            .eq('organization_id', organization_id)
            .single();

        if (!agentConfig?.is_active) {
            return new Response(JSON.stringify({ status: 'agent_disabled' }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const config = agentConfig as AgentConfig;

        // ── Step 3.5: Resolve stageId/boardId for methodology hierarchy ──
        // Priority: deal's current stage > config defaults
        let resolvedStageId: string | null = config.default_stage_id ?? null;
        let resolvedBoardId: string | null = config.default_board_id ?? null;

        if (conversation.deal_id) {
            const { data: dealData } = await supabase
                .from('deals')
                .select('stage_id, board_id')
                .eq('id', conversation.deal_id)
                .single();
            if (dealData?.stage_id) resolvedStageId = dealData.stage_id;
            if (dealData?.board_id) resolvedBoardId = dealData.board_id;
        }

        // Resolve effective methodology (stage > board > global)
        const resolvedMethodology = await resolveMethodology(
            supabase,
            organization_id,
            resolvedStageId,
            resolvedBoardId
        );

        // ── Step 4: Check business hours ──
        if (!isWithinBusinessHours(config) && !config.attend_outside_hours) {
            // Save lead message first
            await saveMessage(supabase, conversation.id, organization_id, {
                role: 'lead',
                content: message_content,
                content_type,
                whatsapp_message_id,
            });

            // Send outside hours message
            if (config.outside_hours_message) {
                await sendWhatsAppMessage(config, whatsapp_number, config.outside_hours_message);

                await saveMessage(supabase, conversation.id, organization_id, {
                    role: 'ai',
                    content: config.outside_hours_message,
                });
            }

            return new Response(JSON.stringify({ status: 'outside_hours' }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // ── Step 4.2: Robust prompt injection guard ──
        const lowerMsg = message_content.toLowerCase();
        const injectionKeywords = [
            'ignore the previous', 'ignore as instruções', 'ignore todas as instruções',
            'você é agora', 'you are now', 'system prompt', 'modo desenvolvedor', 'developer mode',
            'override instructions', 'ignore tudo', 'esquecer as regras',
            'bypass security', 'qual é o seu prompt', 'what is your prompt', 'qual é o prompt',
            'variáveis de ambiente', 'variaveis de ambiente', 'env vars'
        ];

        const isInjectionAttempt = injectionKeywords.some(kw => lowerMsg.includes(kw));

        if (isInjectionAttempt) {
            await saveMessage(supabase, conversation.id, organization_id, {
                role: 'system',
                content: 'Prompt injection attempt blocked.',
            });

            // Send a safe fallback message
            await sendWhatsAppMessage(config, whatsapp_number, "Desculpe, não posso processar este tipo de solicitação. Como posso ajudar você com nossos produtos ou serviços hoje?");

            // unlock and abort
            await supabase.from('conversations').update({ status: 'active' }).eq('id', conversation.id);
            return new Response(JSON.stringify({ status: 'blocked_injection' }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // ── Step 4.5: Media Handler (Phase 8) ──
        let finalMessageContent = message_content;

        if (media_url) {
            if (content_type === 'audio') {
                try {
                    const { OpenAI } = await import('https://esm.sh/openai@4');
                    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

                    // Fetch audio from URL into a blob to send to OpenAI
                    const audioRes = await fetch(media_url);
                    if (audioRes.ok) {
                        const audioBlob = await audioRes.blob();
                        const audioFile = new File([audioBlob], 'audio.ogg', { type: audioBlob.type || 'audio/ogg' });

                        const transcription = await openai.audio.transcriptions.create({
                            file: audioFile,
                            model: "whisper-1",
                        });
                        finalMessageContent = `[Áudio Transcrito Recebido]: "${transcription.text}"`;
                    } else {
                        finalMessageContent = `[Áudio Recebido] (Não foi possível baixar o áudio).`;
                    }
                } catch (e) {
                    console.error('Whisper transcription error:', e);
                    finalMessageContent = `[Áudio Recebido] (Erro na transcrição).`;
                }
            } else if (content_type === 'image') {
                finalMessageContent = `[Imagem Recebida] URL: ${media_url} - ${message_content !== '[mídia]' ? `Legenda: ${message_content}` : ''}`;
            } else if (content_type === 'document' || content_type === 'video') {
                finalMessageContent = `[${content_type === 'video' ? 'Vídeo' : 'Documento'} Recebido URL: ${media_url}] ${message_content !== '[mídia]' ? `Nome/Legenda: ${message_content}` : ''}`;
            }
        }

        // ── Step 5: Save lead message ──
        await saveMessage(supabase, conversation.id, organization_id, {
            role: 'lead',
            content: finalMessageContent,
            content_type,
            whatsapp_message_id,
        });

        // ── Step 6: Check if this is first message → send welcome ──
        const history = await getConversationHistory(supabase, conversation.id, 30);

        const isFirstMessage =
            history.filter((m) => m.role === 'lead').length === 1;

        if (isFirstMessage && config.welcome_message) {
            await sendWhatsAppMessage(config, whatsapp_number, config.welcome_message);
            await saveMessage(supabase, conversation.id, organization_id, {
                role: 'ai',
                content: config.welcome_message,
            });
        }

        // ── Step 6.4: Strict Qualification Guard ──
        const collected = conversation.qualification_data ?? {};
        const pendingFields = config.qualification_fields.filter(
            (f) => f.required && !collected[f.key]
        );

        // If there are pending REQUIRED qualification fields, we append a strict system rule to the latest message
        if (pendingFields.length > 0) {
            finalMessageContent += `\n\n[INSTRUÇÃO DE SISTEMA: O cliente AINDA NÃO preencheu qualificações obrigatórias (${pendingFields.map(f => f.key).join(', ')}). Você DEVE focar sua resposta EM COLETAR ESSAS INFORMAÇÕES AGORA. Não execute nenhuma ferramenta de criação/modificação (create_deal, etc) até que estes dados sejam coletados. Você pode responder à dúvida do usuário brevemente, mas termine a mensagem com a pergunta para coletar o próximo campo pendente.]`;
        }

        // ── Step 6.5: Fetch Knowledge Base (RAG) ──
        const knowledgeContext = await getKnowledgeContext(supabase, organization_id, finalMessageContent);

        // ── Step 7: Compose system prompt (Phase 5: hierarchy-aware) ──
        const systemPrompt = await composeSystemPrompt(
            supabase,
            organization_id,
            config,
            conversation,
            knowledgeContext,
            resolvedMethodology
        );

        // ── Step 8: Check AI quota ──
        const hasQuota = await checkAiQuota(supabase, organization_id);
        if (!hasQuota) {
            const quotaMsg =
                'Desculpe, estamos com alta demanda no momento. Um de nossos atendentes entrará em contato em breve!';
            await sendWhatsAppMessage(config, whatsapp_number, quotaMsg);
            await saveMessage(supabase, conversation.id, organization_id, {
                role: 'system',
                content: 'AI quota exceeded — message not processed by AI.',
            });

            // Create Critical Action Item
            await supabase.from('inbox_action_items').insert({
                organization_id,
                type: 'review',
                priority: 'critical',
                title: `Alerta: Quota de IA Excedida`,
                description: `O NossoAgent parou de responder a ${whatsapp_name || whatsapp_number} pois o limite mensal de tokens foi atingido. Atue manualmente.`,
                status: 'pending',
            });

            return new Response(JSON.stringify({ status: 'quota_exceeded' }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // ── Step 9: Generate AI response ──
        // NOTE: In production, this uses Vercel AI SDK with tool-calling.
        // For this Phase 3, we set up the structure. Phase 4 adds the actual tools.
        const aiMessages = history
            .filter((m) => m.role === 'lead' || m.role === 'ai')
            .map((m) => ({
                role: m.role === 'lead' ? 'user' as const : 'assistant' as const,
                content: m.content,
            }));

        // Append the final injected message as the latest interaction (overriding history's last message if needed, or simply replacing it)
        if (aiMessages.length > 0 && aiMessages[aiMessages.length - 1].role === 'user') {
            aiMessages[aiMessages.length - 1].content = finalMessageContent;
        }

        // Dynamic import for AI SDK (Deno compatible)
        const { generateText } = await import('https://esm.sh/ai@4');
        const { createAnthropic } = await import('https://esm.sh/@ai-sdk/anthropic@1');

        const anthropic = createAnthropic({
            apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
        });

        const { buildAgentTools } = await import('../../../lib/ai/agent-tools.ts');
        const aiTools = buildAgentTools({
            supabase,
            organizationId: organization_id,
            conversationId: conversation.id,
            agentConfig: {
                default_board_id: config.default_board_id,
                default_stage_id: config.default_stage_id,
            }
        });

        const result = await generateText({
            model: anthropic(config.ai_model),
            system: systemPrompt,
            messages: aiMessages,
            temperature: config.ai_temperature,
            maxTokens: config.max_tokens_per_response,
            tools: aiTools,
            maxSteps: 5,
        });

        const aiResponse = result.text;
        const executedTools = result.steps?.flatMap(s => s.toolCalls.map(t => t.toolName)) || [];

        // ── Step 10: Save AI response ──
        await saveMessage(supabase, conversation.id, organization_id, {
            role: 'ai',
            content: aiResponse,
            ai_model: config.ai_model,
            ai_tokens_input: result.usage?.promptTokens ?? 0,
            ai_tokens_output: result.usage?.completionTokens ?? 0,
            ai_tools_used: executedTools,
        });

        // ── Step 11: Send via WhatsApp ──
        await sendWhatsAppMessage(config, whatsapp_number, aiResponse);

        // ── Step 12: Log AI usage (governance) ──
        await logAiUsage(supabase, {
            organization_id,
            action: 'agent_response',
            model: config.ai_model,
            tokens_input: result.usage?.promptTokens ?? 0,
            tokens_output: result.usage?.completionTokens ?? 0,
        });

        // ── Step 13: Post-processing (Summary) ──
        await postProcess(supabase, config, conversation, history, aiResponse);

        // ── Step 13.5: Track performance metric for Aprender mode ──
        await trackConversationMetric(
            supabase,
            organization_id,
            resolvedBoardId,
            resolvedStageId,
            resolvedMethodology.agent_role,
            history.length + 1
        );

        // ── Step 14: Update conversation timestamp and unlock ──
        await supabase
            .from('conversations')
            .update({
                status: 'active', // Unlock
                last_ai_response_at: new Date().toISOString(),
                ...(isFirstMessage
                    ? {
                        first_response_time_ms: Date.now() - new Date(payload.whatsapp_timestamp).getTime(),
                    }
                    : {}),
            })
            .eq('id', conversation.id);

        return new Response(
            JSON.stringify({
                status: 'ok',
                conversation_id: conversation.id,
                tokens: {
                    input: result.usage?.promptTokens ?? 0,
                    output: result.usage?.completionTokens ?? 0,
                },
            }),
            { headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Agent engine error:', error);
        return new Response(
            JSON.stringify({
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
});
