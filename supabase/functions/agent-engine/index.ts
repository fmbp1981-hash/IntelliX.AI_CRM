// supabase/functions/agent-engine/index.ts
// The core AI engine — processes incoming messages, generates responses via tool-calling
// Called internally by agent-webhook. Requires JWT (service role).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
        .in('status', ['active', 'waiting_human', 'human_active'])
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
// Helper: Compose system prompt
// ============================================

async function composeSystemPrompt(
    supabase: SupabaseClient,
    orgId: string,
    config: AgentConfig,
    conversation: Conversation
): Promise<string> {
    const parts: string[] = [];

    // 1. Base identity prompt
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

    // 2. Vertical context (if verticalizada)
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

    // 3. Agent-specific override
    if (config.system_prompt_override) {
        parts.push(`\n## INSTRUÇÕES ESPECÍFICAS DA EMPRESA\n${config.system_prompt_override}`);
    }

    // 4. Qualification context
    if (config.qualification_fields.length > 0) {
        const collected = conversation.qualification_data ?? {};
        const pending = config.qualification_fields.filter(
            (f) => !collected[f.key]
        );

        if (pending.length > 0) {
            parts.push(`\n## QUALIFICAÇÃO PENDENTE\nColete os seguintes campos naturalmente durante a conversa:\n${pending.map((f) => `- ${f.key}: "${f.question}" ${f.required ? '(obrigatório)' : '(opcional)'}`).join('\n')}`);
        } else {
            parts.push('\n## QUALIFICAÇÃO\nTodos os campos de qualificação já foram coletados. ✅');
        }
    }

    // 5. Entity context (linked contact/deal)
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

    // 6. Conversation summary
    if (conversation.summary) {
        parts.push(`\n## RESUMO DA CONVERSA ATÉ AQUI\n${conversation.summary}`);
    }

    return parts.join('\n');
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
    conversation: Conversation,
    messageCount: number,
    aiResponse: string
): Promise<void> {
    // Update summary every 5 messages
    if (messageCount % 5 === 0) {
        // For now, just use the latest AI response as part of the summary
        // In production, this would call the AI to generate a summary
        await supabase
            .from('conversations')
            .update({
                summary: `Conversa com ${messageCount} mensagens. Última resposta IA: ${aiResponse.substring(0, 200)}...`,
            })
            .eq('id', conversation.id);
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

        // ── Step 2: If human is active, just save message (human sees via Realtime) ──
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

        // ── Step 5: Save lead message ──
        await saveMessage(supabase, conversation.id, organization_id, {
            role: 'lead',
            content: message_content,
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

        // ── Step 7: Compose system prompt ──
        const systemPrompt = await composeSystemPrompt(
            supabase,
            organization_id,
            config,
            conversation
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

        // Dynamic import for AI SDK (Deno compatible)
        const { generateText } = await import('https://esm.sh/ai@4');
        const { createAnthropic } = await import('https://esm.sh/@ai-sdk/anthropic@1');

        const anthropic = createAnthropic({
            apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
        });

        const result = await generateText({
            model: anthropic(config.ai_model),
            system: systemPrompt,
            messages: aiMessages,
            temperature: config.ai_temperature,
            maxTokens: config.max_tokens_per_response,
            // tools will be added in Phase 4
        });

        const aiResponse = result.text;

        // ── Step 10: Save AI response ──
        await saveMessage(supabase, conversation.id, organization_id, {
            role: 'ai',
            content: aiResponse,
            ai_model: config.ai_model,
            ai_tokens_input: result.usage?.promptTokens ?? 0,
            ai_tokens_output: result.usage?.completionTokens ?? 0,
            ai_tools_used: [],
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

        // ── Step 13: Post-processing ──
        await postProcess(supabase, conversation, history.length, aiResponse);

        // ── Step 14: Update conversation timestamp ──
        await supabase
            .from('conversations')
            .update({
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
