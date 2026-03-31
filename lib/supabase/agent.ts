// lib/supabase/agent.ts — NossoAgent service layer

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    AgentConfig,
    Conversation,
    ConversationsFilter,
    Message,
    MessagesFilter,
    AgentToolLog,
} from '@/types/agent';

// ============================================
// Agent Config
// ============================================

export async function getAgentConfig(
    supabase: SupabaseClient,
    organizationId: string
): Promise<AgentConfig | null> {
    const { data, error } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as AgentConfig | null;
}

export async function upsertAgentConfig(
    supabase: SupabaseClient,
    organizationId: string,
    config: Partial<AgentConfig>
): Promise<AgentConfig> {
    const { data, error } = await supabase
        .from('agent_configs')
        .upsert(
            { ...config, organization_id: organizationId },
            { onConflict: 'organization_id' }
        )
        .select()
        .single();

    if (error) throw error;
    return data as AgentConfig;
}

// ============================================
// Conversations
// ============================================

export async function listConversations(
    supabase: SupabaseClient,
    organizationId: string,
    filter?: ConversationsFilter
): Promise<Conversation[]> {
    let query = supabase
        .from('conversations')
        .select('*')
        .eq('organization_id', organizationId)
        .order('last_message_at', { ascending: false, nullsFirst: false });

    if (filter?.status) {
        query = query.eq('status', filter.status);
    }
    if (filter?.assigned_agent) {
        query = query.eq('assigned_agent', filter.assigned_agent);
    }
    if (filter?.qualification_status) {
        query = query.eq('qualification_status', filter.qualification_status);
    }
    if (filter?.search) {
        query = query.or(
            `whatsapp_name.ilike.%${filter.search}%,whatsapp_number.ilike.%${filter.search}%`
        );
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Conversation[];
}

export async function getConversation(
    supabase: SupabaseClient,
    conversationId: string
): Promise<Conversation | null> {
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Conversation | null;
}

export async function findConversationByWhatsApp(
    supabase: SupabaseClient,
    organizationId: string,
    whatsappNumber: string
): Promise<Conversation | null> {
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('whatsapp_number', whatsappNumber)
        .in('status', ['active', 'waiting_human', 'human_active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Conversation | null;
}

export async function createConversation(
    supabase: SupabaseClient,
    conversation: Pick<Conversation, 'organization_id' | 'whatsapp_number' | 'whatsapp_name' | 'whatsapp_profile_pic_url'>
): Promise<Conversation> {
    const { data, error } = await supabase
        .from('conversations')
        .insert(conversation)
        .select()
        .single();

    if (error) throw error;
    return data as Conversation;
}

export async function updateConversation(
    supabase: SupabaseClient,
    conversationId: string,
    updates: Partial<Conversation>
): Promise<Conversation> {
    const { data, error } = await supabase
        .from('conversations')
        .update(updates)
        .eq('id', conversationId)
        .select()
        .single();

    if (error) throw error;
    return data as Conversation;
}

// ============================================
// Messages
// ============================================

export async function listMessages(
    supabase: SupabaseClient,
    filter: MessagesFilter
): Promise<Message[]> {
    let query = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', filter.conversation_id)
        .order('created_at', { ascending: true });

    if (filter.before) {
        query = query.lt('created_at', filter.before);
    }
    if (filter.limit) {
        query = query.limit(filter.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Message[];
}

export async function createMessage(
    supabase: SupabaseClient,
    message: Pick<
        Message,
        'conversation_id' | 'organization_id' | 'role' | 'content' | 'content_type'
    > &
        Partial<Message>
): Promise<Message> {
    const { data, error } = await supabase
        .from('messages')
        .insert(message)
        .select()
        .single();

    if (error) throw error;
    return data as Message;
}

// ============================================
// Agent Tools Log
// ============================================

export async function logAgentTool(
    supabase: SupabaseClient,
    log: Pick<
        AgentToolLog,
        'organization_id' | 'conversation_id' | 'tool_name' | 'tool_input'
    > &
        Partial<AgentToolLog>
): Promise<AgentToolLog> {
    const { data, error } = await supabase
        .from('agent_tools_log')
        .insert(log)
        .select()
        .single();

    if (error) throw error;
    return data as AgentToolLog;
}

export async function listAgentToolLogs(
    supabase: SupabaseClient,
    conversationId: string
): Promise<AgentToolLog[]> {
    const { data, error } = await supabase
        .from('agent_tools_log')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as AgentToolLog[];
}
