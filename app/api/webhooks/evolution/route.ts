// app/api/webhooks/evolution/route.ts
// Evolution API Webhook Handler — receives incoming WhatsApp messages, routes
// through the NossoAgent AI, and sends replies back via Evolution API.
//
// POST /api/webhooks/evolution
// Expected by Evolution API "messages.upsert" event with the apikey field in body.

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createClient as createStaticClient } from '@supabase/supabase-js';
import {
    findConversationByWhatsApp,
    createConversation,
    updateConversation,
    createMessage,
    listMessages,
    getAgentConfig,
} from '@/lib/supabase/agent';
import { sendEvolutionTextMessage } from '@/lib/evolution/client';
import { dispatchAgentEvent, checkAiGovernance } from '@/lib/agent/crm-integrations';
import { buildPersonalizedSystemPrompt } from '@/lib/ai/prompt-builder';
import { AGENT_SYSTEM_PROMPT_BASE } from '@/lib/ai/agent-prompts';
import type { AgentConfig, EvolutionApiConfig } from '@/types/agent';

export const maxDuration = 60;

// ─── Evolution API payload types ─────────────────────────────────────────────

interface EvolutionMessageKey {
    remoteJid: string;
    fromMe: boolean;
    id: string;
}

interface EvolutionMessageContent {
    conversation?: string;
    extendedTextMessage?: { text: string };
    imageMessage?: { caption?: string; url?: string };
    audioMessage?: { url?: string };
    documentMessage?: { caption?: string; fileName?: string };
    videoMessage?: { caption?: string };
    stickerMessage?: object;
    reactionMessage?: { text?: string };
    locationMessage?: { degreesLatitude?: number; degreesLongitude?: number; name?: string };
}

interface EvolutionWebhookData {
    key: EvolutionMessageKey;
    pushName?: string;
    message?: EvolutionMessageContent;
    messageType?: string;
    messageTimestamp?: number;
}

interface EvolutionWebhookPayload {
    event: string;
    instance: string;
    data: EvolutionWebhookData;
    destination?: string;
    date_time?: string;
    sender?: string;
    server_url?: string;
    apikey?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extracts plain text from various Evolution message types. Returns null for non-text. */
function extractMessageText(msg: EvolutionMessageContent): string | null {
    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return `[imagem] ${msg.imageMessage.caption}`;
    if (msg.videoMessage?.caption) return `[vídeo] ${msg.videoMessage.caption}`;
    if (msg.documentMessage?.caption)
        return `[documento: ${msg.documentMessage.fileName ?? 'arquivo'}] ${msg.documentMessage.caption}`;
    if (msg.documentMessage?.fileName)
        return `[documento: ${msg.documentMessage.fileName}]`;
    if (msg.audioMessage) return '[mensagem de áudio]';
    if (msg.locationMessage?.name) return `[localização: ${msg.locationMessage.name}]`;
    if (msg.locationMessage) return '[localização compartilhada]';
    if (msg.stickerMessage) return null; // ignore stickers silently
    if (msg.reactionMessage) return null; // ignore reactions silently
    return null;
}

/** Normalizes remoteJid to a plain phone number string. */
function normalizeNumber(remoteJid: string): string {
    // Evolution sends "5511999999999@s.whatsapp.net" or "5511999999999@g.us" for groups
    return remoteJid.split('@')[0];
}

/** Checks if remoteJid is a group (ends with @g.us) — we skip group messages. */
function isGroupMessage(remoteJid: string): boolean {
    return remoteJid.endsWith('@g.us');
}

/** Selects AI model from provider string. */
function buildAIModel(provider: string, modelId: string, apiKey: string) {
    switch (provider) {
        case 'openai': {
            const openai = createOpenAI({ apiKey });
            return openai(modelId);
        }
        case 'anthropic': {
            const anthropic = createAnthropic({ apiKey });
            return anthropic(modelId);
        }
        case 'google':
        default: {
            const google = createGoogleGenerativeAI({ apiKey });
            return google(modelId);
        }
    }
}

/** Resolves the AI provider and api key from organization_settings. */
async function resolveAISettings(
    // Accept any Supabase-like client regardless of Database generic params
    supabase: { from: (table: string) => any },
    organizationId: string
): Promise<{ provider: string; modelId: string; apiKey: string } | null> {
    const { data: rawData } = await supabase
        .from('organization_settings')
        .select('ai_provider, ai_model, ai_google_key, ai_openai_key, ai_anthropic_key')
        .eq('organization_id', organizationId)
        .single();

    if (!rawData) return null;

    const data = rawData as unknown as {
        ai_provider?: string;
        ai_model?: string;
        ai_google_key?: string;
        ai_openai_key?: string;
        ai_anthropic_key?: string;
    };

    const provider: string = data.ai_provider ?? 'google';
    const modelId: string = data.ai_model ?? 'gemini-2.0-flash-exp';
    const apiKeyMap: Record<string, string | undefined> = {
        google: data.ai_google_key,
        openai: data.ai_openai_key,
        anthropic: data.ai_anthropic_key,
    };
    const apiKey = apiKeyMap[provider] as string | undefined;

    if (!apiKey) return null;

    return { provider, modelId, apiKey };
}

/** Builds the system prompt for the NossoAgent WhatsApp bot. */
function buildNossoAgentPrompt(config: AgentConfig): string {
    const base = config.system_prompt_override ?? AGENT_SYSTEM_PROMPT_BASE;

    if (config.persona || config.tone_of_voice || config.sales_methodology) {
        return buildPersonalizedSystemPrompt({
            basePrompt: base,
            agentRole: config.agent_name ?? 'Assistente',
            methodology: config.sales_methodology?.primary ?? 'consultivo',
            tone: config.tone_of_voice ?? null,
            personalization: {
                persona: config.persona ?? undefined,
                tone_of_voice: config.tone_of_voice ?? undefined,
                sales_methodology: config.sales_methodology ?? undefined,
                knowledge_base_config: config.knowledge_base_config ?? undefined,
                business_context_extended: config.business_context_extended ?? undefined,
                behavioral_training: config.behavioral_training ?? undefined,
            },
        });
    }

    return base;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
    let payload: EvolutionWebhookPayload;

    try {
        payload = (await request.json()) as EvolutionWebhookPayload;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Only process messages.upsert events
    if (payload.event !== 'messages.upsert') {
        return NextResponse.json({ ok: true, skipped: true });
    }

    const { instance, data } = payload;

    // Skip group messages and status broadcasts
    if (!data?.key?.remoteJid || isGroupMessage(data.key.remoteJid)) {
        return NextResponse.json({ ok: true, skipped: true });
    }

    // Skip messages sent by the bot itself
    if (data.key.fromMe) {
        return NextResponse.json({ ok: true, skipped: true });
    }

    // Extract text content — skip non-text message types silently (stickers, reactions)
    const messageText = data.message ? extractMessageText(data.message) : null;
    if (!messageText) {
        return NextResponse.json({ ok: true, skipped: true });
    }

    const whatsappNumber = normalizeNumber(data.key.remoteJid);
    const whatsappName = data.pushName ?? null;
    const whatsappMessageId = data.key.id;

    // Build a service-role Supabase client (webhook has no user session)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('[Evolution Webhook] Missing Supabase env vars');
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const supabase = createStaticClient(supabaseUrl, supabaseServiceKey);

    try {
        // ── 1. Find organization by Evolution instance name ───────────────────
        const { data: agentConfigRow, error: configError } = await supabase
            .from('agent_configs')
            .select('*')
            .eq('whatsapp_provider', 'evolution_api')
            .filter('whatsapp_config->>instance_name', 'eq', instance)
            .eq('is_active', true)
            .single();

        if (configError || !agentConfigRow) {
            console.warn(`[Evolution Webhook] No active agent config for instance: ${instance}`);
            return NextResponse.json({ error: 'Instance not configured' }, { status: 404 });
        }

        const agentConfig = agentConfigRow as AgentConfig;
        const organizationId = agentConfig.organization_id;
        const evolutionConfig = agentConfig.whatsapp_config as EvolutionApiConfig;

        // ── 2. Validate webhook api key (security) ───────────────────────────
        if (payload.apikey && payload.apikey !== evolutionConfig.api_key) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // ── 3. Find or create conversation ───────────────────────────────────
        let conversation = await findConversationByWhatsApp(
            supabase,
            organizationId,
            whatsappNumber
        );

        const isNewConversation = !conversation;

        if (!conversation) {
            conversation = await createConversation(supabase, {
                organization_id: organizationId,
                whatsapp_number: whatsappNumber,
                whatsapp_name: whatsappName,
                whatsapp_profile_pic_url: null,
            });
        } else if (whatsappName && conversation.whatsapp_name !== whatsappName) {
            // Update name if changed
            conversation = await updateConversation(supabase, conversation.id, {
                whatsapp_name: whatsappName,
            });
        }

        // ── 4. Deduplicate: skip if this message was already processed ────────
        const { data: existing } = await supabase
            .from('messages')
            .select('id')
            .eq('whatsapp_message_id', whatsappMessageId)
            .single();

        if (existing) {
            return NextResponse.json({ ok: true, skipped: true, reason: 'duplicate' });
        }

        // ── 5. Store incoming message ─────────────────────────────────────────
        const leadMessage = await createMessage(supabase, {
            conversation_id: conversation.id,
            organization_id: organizationId,
            role: 'lead',
            content: messageText,
            content_type: 'text',
            whatsapp_message_id: whatsappMessageId,
            whatsapp_timestamp: data.messageTimestamp
                ? new Date(data.messageTimestamp * 1000).toISOString()
                : null,
            is_internal_note: false,
        });

        // Update conversation's last_message_at
        await updateConversation(supabase, conversation.id, {
            last_message_at: leadMessage.created_at,
        });

        // ── 6. Dispatch conversation started event for new conversations ──────
        if (isNewConversation) {
            await dispatchAgentEvent(supabase, {
                organizationId,
                conversationId: conversation.id,
                type: 'conversation.started',
                data: { whatsapp_name: whatsappName ?? whatsappNumber },
            });
        }

        // ── 7. Route: only process with AI if status is 'active' ─────────────
        if (conversation.status !== 'active') {
            // Human is handling this conversation — just persist the message
            return NextResponse.json({ ok: true, routed: 'human' });
        }

        // ── 8. Check AI governance (quotas, enabled flag) ─────────────────────
        const governance = await checkAiGovernance(supabase, organizationId);
        if (!governance.allowed) {
            console.warn(`[Evolution Webhook] AI not allowed: ${governance.reason}`);
            // Transfer to human if AI quota exceeded
            await updateConversation(supabase, conversation.id, {
                status: 'waiting_human',
            });
            await sendEvolutionTextMessage(
                evolutionConfig.api_url,
                evolutionConfig.api_key,
                evolutionConfig.instance_name,
                whatsappNumber,
                agentConfig.transfer_message ?? 'Transferindo para nossa equipe.'
            );
            return NextResponse.json({ ok: true, routed: 'quota_exceeded' });
        }

        // ── 9. Check max messages before forced transfer ──────────────────────
        if (agentConfig.max_messages_before_transfer != null) {
            const { count } = await supabase
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('conversation_id', conversation.id)
                .eq('role', 'ai');

            if ((count ?? 0) >= agentConfig.max_messages_before_transfer) {
                await updateConversation(supabase, conversation.id, {
                    status: 'waiting_human',
                    transferred_at: new Date().toISOString(),
                });
                await dispatchAgentEvent(supabase, {
                    organizationId,
                    conversationId: conversation.id,
                    type: 'conversation.transferred',
                    data: {
                        reason: 'Limite de mensagens da IA atingido',
                        priority: 'medium',
                        summary: `Conversa com ${whatsappName ?? whatsappNumber} transferida após ${agentConfig.max_messages_before_transfer} mensagens.`,
                    },
                });
                await sendEvolutionTextMessage(
                    evolutionConfig.api_url,
                    evolutionConfig.api_key,
                    evolutionConfig.instance_name,
                    whatsappNumber,
                    agentConfig.transfer_message ?? 'Vou conectar você com nossa equipe!'
                );
                return NextResponse.json({ ok: true, routed: 'transfer' });
            }
        }

        // ── 10. Resolve AI provider and key ───────────────────────────────────
        const aiSettings = await resolveAISettings(supabase, organizationId);
        if (!aiSettings) {
            console.error(`[Evolution Webhook] No AI settings for org: ${organizationId}`);
            return NextResponse.json({ error: 'AI not configured' }, { status: 500 });
        }

        // ── 11. Load recent conversation history for context ──────────────────
        const recentMessages = await listMessages(supabase, {
            conversation_id: conversation.id,
            limit: 20,
        });

        // Build messages array for AI (exclude the just-inserted lead message,
        // which we'll add last; filter out internal notes)
        type AIMessageRole = 'user' | 'assistant';
        const historyMessages = recentMessages
            .filter((m) => !m.is_internal_note && m.id !== leadMessage.id)
            .map((m) => ({
                role: (m.role === 'lead' ? 'user' : 'assistant') as AIMessageRole,
                content: m.content,
            }));

        // Add the current message
        historyMessages.push({ role: 'user', content: messageText });

        // ── 12. Generate AI response ──────────────────────────────────────────
        const systemPrompt = buildNossoAgentPrompt(agentConfig);
        const model = buildAIModel(aiSettings.provider, aiSettings.modelId, aiSettings.apiKey);

        const { text: aiResponse, usage } = await generateText({
            model,
            system: systemPrompt,
            messages: historyMessages,
            maxTokens: agentConfig.max_tokens_per_response ?? 1024,
            temperature: agentConfig.ai_temperature ?? 0.7,
        });

        if (!aiResponse?.trim()) {
            console.warn(`[Evolution Webhook] Empty AI response for conversation: ${conversation.id}`);
            return NextResponse.json({ ok: true, routed: 'ai_empty_response' });
        }

        // ── 13. Store AI message ──────────────────────────────────────────────
        const now = new Date().toISOString();
        await createMessage(supabase, {
            conversation_id: conversation.id,
            organization_id: organizationId,
            role: 'ai',
            content: aiResponse.trim(),
            content_type: 'text',
            ai_model: aiSettings.modelId,
            ai_tokens_input: usage?.promptTokens ?? null,
            ai_tokens_output: usage?.completionTokens ?? null,
            ai_tools_used: [],
            is_internal_note: false,
        });

        await updateConversation(supabase, conversation.id, {
            last_message_at: now,
            last_ai_response_at: now,
            first_response_time_ms:
                !conversation.first_response_time_ms && isNewConversation
                    ? Date.now() - new Date(conversation.created_at).getTime()
                    : undefined,
        });

        // ── 14. Send reply via Evolution API ──────────────────────────────────
        await sendEvolutionTextMessage(
            evolutionConfig.api_url,
            evolutionConfig.api_key,
            evolutionConfig.instance_name,
            whatsappNumber,
            aiResponse.trim()
        );

        return NextResponse.json({ ok: true, routed: 'ai' });
    } catch (err) {
        console.error('[Evolution Webhook] Unhandled error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
