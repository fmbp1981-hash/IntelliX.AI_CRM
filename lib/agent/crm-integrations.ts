// lib/agent/crm-integrations.ts
// NossoAgent ↔ CRM bridge — connects agent events to existing CRM infrastructure
// Links: Inbox Action Items, Webhook Events, AI Governance, Notifications

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================
// Types
// ============================================

interface AgentEvent {
    organizationId: string;
    conversationId: string;
    type: AgentEventType;
    data: Record<string, unknown>;
}

type AgentEventType =
    | 'conversation.started'
    | 'conversation.qualified'
    | 'conversation.transferred'
    | 'conversation.closed'
    | 'contact.created_by_agent'
    | 'deal.created_by_agent'
    | 'deal.moved_by_agent'
    | 'agent.error'
    | 'agent.quota_exceeded';

// ============================================
// Main dispatcher
// ============================================

export async function dispatchAgentEvent(
    supabase: SupabaseClient,
    event: AgentEvent
): Promise<void> {
    const handlers: Partial<Record<AgentEventType, () => Promise<void>>> = {
        'conversation.started': () => handleConversationStarted(supabase, event),
        'conversation.qualified': () => handleQualified(supabase, event),
        'conversation.transferred': () => handleTransferred(supabase, event),
        'conversation.closed': () => handleClosed(supabase, event),
        'contact.created_by_agent': () => handleContactCreated(supabase, event),
        'deal.created_by_agent': () => handleDealCreated(supabase, event),
        'deal.moved_by_agent': () => handleDealMoved(supabase, event),
        'agent.error': () => handleAgentError(supabase, event),
        'agent.quota_exceeded': () => handleQuotaExceeded(supabase, event),
    };

    const handler = handlers[event.type];
    if (handler) {
        try {
            await handler();
        } catch (err) {
            console.error(`[AgentCRM] Error handling event ${event.type}:`, err);
        }
    }

    // Always dispatch webhook event for external integrations
    await dispatchWebhookEvent(supabase, event);
}

// ============================================
// Event handlers
// ============================================

async function handleConversationStarted(
    supabase: SupabaseClient,
    event: AgentEvent
): Promise<void> {
    // Create notification
    await supabase.from('system_notifications').insert({
        organization_id: event.organizationId,
        type: 'agent_conversation',
        title: 'Nova conversa iniciada',
        message: `NossoAgent iniciou uma nova conversa${event.data.whatsapp_name ? ` com ${event.data.whatsapp_name}` : ''}.`,
        link: `/conversas?id=${event.conversationId}`,
        severity: 'low',
    });
}

async function handleQualified(
    supabase: SupabaseClient,
    event: AgentEvent
): Promise<void> {
    const isQualified = event.data.qualified as boolean;
    const score = event.data.score as number;

    // Create inbox action item
    await supabase.from('inbox_action_items').insert({
        organization_id: event.organizationId,
        type: isQualified ? 'follow_up' : 'review',
        priority: isQualified && score >= 70 ? 'high' : 'medium',
        title: isQualified
            ? `Lead qualificado (score ${score}) — agendar contato`
            : `Lead não qualificado (score ${score}) — revisão`,
        description: JSON.stringify(event.data.collected_data ?? {}),
        metadata: {
            conversation_id: event.conversationId,
            source: 'nossoagent',
            qualification_score: score,
        },
        status: 'pending',
    });

    // High-value leads get priority notification
    if (isQualified && score >= 80) {
        await supabase.from('system_notifications').insert({
            organization_id: event.organizationId,
            type: 'agent_lead_qualified',
            title: '🔥 Lead quente qualificado!',
            message: `Score ${score}/100. Recomendado contato imediato.`,
            link: `/conversas?id=${event.conversationId}`,
            severity: 'high',
        });
    }
}

async function handleTransferred(
    supabase: SupabaseClient,
    event: AgentEvent
): Promise<void> {
    await supabase.from('inbox_action_items').insert({
        organization_id: event.organizationId,
        type: 'transfer',
        priority: (event.data.priority as string) ?? 'medium',
        title: `Conversa transferida: ${event.data.reason ?? 'Motivo não informado'}`,
        description: event.data.summary as string,
        metadata: {
            conversation_id: event.conversationId,
            source: 'nossoagent',
        },
        status: 'pending',
    });

    await supabase.from('system_notifications').insert({
        organization_id: event.organizationId,
        type: 'agent_transfer',
        title: '🔄 Conversa transferida para humano',
        message: event.data.reason as string,
        link: `/conversas?id=${event.conversationId}`,
        severity: event.data.priority === 'critical' ? 'high' : 'medium',
    });
}

async function handleClosed(
    supabase: SupabaseClient,
    event: AgentEvent
): Promise<void> {
    // Log AI usage summary for the conversation
    const { data: msgs } = await supabase
        .from('messages')
        .select('id, role, tokens_used')
        .eq('conversation_id', event.conversationId);

    const totalMessages = msgs?.length ?? 0;
    const aiMessages = msgs?.filter((m: any) => m.role === 'ai').length ?? 0;
    const totalTokens = msgs?.reduce((sum: number, m: any) => sum + (m.tokens_used ?? 0), 0) ?? 0;

    await supabase.from('ai_usage_logs').insert({
        organization_id: event.organizationId,
        feature: 'nossoagent',
        action: 'conversation_completed',
        model: event.data.ai_model as string,
        tokens_used: totalTokens,
        metadata: {
            conversation_id: event.conversationId,
            total_messages: totalMessages,
            ai_messages: aiMessages,
            duration_minutes: event.data.duration_minutes,
        },
    });
}

async function handleContactCreated(
    supabase: SupabaseClient,
    event: AgentEvent
): Promise<void> {
    await supabase.from('system_notifications').insert({
        organization_id: event.organizationId,
        type: 'agent_contact_created',
        title: `Contato criado pelo NossoAgent`,
        message: `${event.data.contact_name} adicionado automaticamente ao CRM.`,
        link: `/contacts?search=${event.data.contact_name}`,
        severity: 'low',
    });
}

async function handleDealCreated(
    supabase: SupabaseClient,
    event: AgentEvent
): Promise<void> {
    await supabase.from('inbox_action_items').insert({
        organization_id: event.organizationId,
        type: 'new_deal',
        priority: 'medium',
        title: `Deal criado pelo NossoAgent: ${event.data.deal_title}`,
        description: `Valor: R$ ${(event.data.deal_value as number)?.toLocaleString('pt-BR') ?? '0'}`,
        metadata: {
            conversation_id: event.conversationId,
            deal_id: event.data.deal_id,
            source: 'nossoagent',
        },
        status: 'pending',
    });
}

async function handleDealMoved(
    supabase: SupabaseClient,
    event: AgentEvent
): Promise<void> {
    // Activity already created by the tool itself — just notify
    await supabase.from('system_notifications').insert({
        organization_id: event.organizationId,
        type: 'agent_deal_moved',
        title: `Deal movido pelo NossoAgent`,
        message: event.data.reason as string,
        link: `/boards`,
        severity: 'low',
    });
}

async function handleAgentError(
    supabase: SupabaseClient,
    event: AgentEvent
): Promise<void> {
    await supabase.from('system_notifications').insert({
        organization_id: event.organizationId,
        type: 'agent_error',
        title: '⚠️ Erro no NossoAgent',
        message: event.data.error_message as string,
        link: `/conversas?id=${event.conversationId}`,
        severity: 'high',
    });

    // Auto-transfer on critical errors
    if (event.data.critical) {
        await supabase
            .from('conversations')
            .update({ status: 'waiting_human' })
            .eq('id', event.conversationId);
    }
}

async function handleQuotaExceeded(
    supabase: SupabaseClient,
    event: AgentEvent
): Promise<void> {
    await supabase.from('system_notifications').insert({
        organization_id: event.organizationId,
        type: 'agent_quota',
        title: '🚫 Cota de IA excedida',
        message: 'O NossoAgent foi pausado por exceder a cota de tokens. Aumente a cota ou aguarde a renovação.',
        severity: 'high',
    });

    // Deactivate agent
    await supabase
        .from('agent_configs')
        .update({ is_active: false })
        .eq('organization_id', event.organizationId);
}

// ============================================
// Webhook dispatch (external integrations)
// ============================================

async function dispatchWebhookEvent(
    supabase: SupabaseClient,
    event: AgentEvent
): Promise<void> {
    // Map agent events to webhook event types
    const webhookMap: Partial<Record<AgentEventType, string>> = {
        'conversation.started': 'agent.conversation.started',
        'conversation.qualified': 'agent.lead.qualified',
        'conversation.transferred': 'agent.conversation.transferred',
        'conversation.closed': 'agent.conversation.closed',
        'contact.created_by_agent': 'contact.created',
        'deal.created_by_agent': 'deal.created',
        'deal.moved_by_agent': 'deal.stage_changed',
    };

    const webhookEventType = webhookMap[event.type];
    if (!webhookEventType) return;

    // Insert into webhook_events for processing by existing webhook infra
    await supabase.from('webhook_events').insert({
        organization_id: event.organizationId,
        event_type: webhookEventType,
        payload: {
            ...event.data,
            conversation_id: event.conversationId,
            source: 'nossoagent',
            timestamp: new Date().toISOString(),
        },
        status: 'pending',
    });
}

// ============================================
// AI Governance bridge
// ============================================

export async function checkAiGovernance(
    supabase: SupabaseClient,
    organizationId: string
): Promise<{ allowed: boolean; reason?: string; remainingTokens?: number }> {
    // Check organization AI settings
    const { data: orgSettings } = await supabase
        .from('organization_settings')
        .select('ai_enabled, ai_anthropic_key')
        .eq('organization_id', organizationId)
        .single();

    if (!orgSettings?.ai_enabled) {
        return { allowed: false, reason: 'AI disabled for this organization' };
    }

    // Check AI quotas
    const { data: quota } = await supabase
        .from('ai_quotas')
        .select('tokens_limit, tokens_used, reset_at')
        .eq('organization_id', organizationId)
        .single();

    if (quota) {
        const remaining = (quota.tokens_limit ?? Infinity) - (quota.tokens_used ?? 0);
        if (remaining <= 0) {
            return { allowed: false, reason: 'Token quota exceeded', remainingTokens: 0 };
        }
        return { allowed: true, remainingTokens: remaining };
    }

    return { allowed: true };
}

export async function logAiUsage(
    supabase: SupabaseClient,
    organizationId: string,
    tokensUsed: number,
    model: string,
    metadata: Record<string, unknown> = {}
): Promise<void> {
    // Log to ai_usage_logs
    await supabase.from('ai_usage_logs').insert({
        organization_id: organizationId,
        feature: 'nossoagent',
        action: 'message_generated',
        model,
        tokens_used: tokensUsed,
        metadata,
    });

    // Update quota counter
    await supabase.rpc('increment_ai_quota_usage', {
        p_organization_id: organizationId,
        p_tokens: tokensUsed,
    });
}
