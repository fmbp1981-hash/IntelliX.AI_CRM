// types/agent.ts — NossoAgent core types

// ============================================
// Agent Config
// ============================================

export interface BusinessHoursDay {
    start: string | null;
    end: string | null;
    active: boolean;
}

export interface BusinessHours {
    monday: BusinessHoursDay;
    tuesday: BusinessHoursDay;
    wednesday: BusinessHoursDay;
    thursday: BusinessHoursDay;
    friday: BusinessHoursDay;
    saturday: BusinessHoursDay;
    sunday: BusinessHoursDay;
}

export interface QualificationField {
    key: string;
    question: string;
    type: 'text' | 'select' | 'boolean';
    required: boolean;
    options?: string[];
}

export interface TransferRule {
    condition: string;
    transfer_to: string;
    message: string;
}

export type WhatsAppProvider = 'whatsapp_cloud_api' | 'evolution_api';

export interface CloudApiConfig {
    phone_number_id: string;
    access_token: string;
    business_id: string;
    webhook_verify_token: string;
}

export interface EvolutionApiConfig {
    instance_name: string;
    api_url: string;
    api_key: string;
    webhook_url?: string;
}

export type WhatsAppConfig = CloudApiConfig | EvolutionApiConfig;

export interface AgentConfig {
    id: string;
    organization_id: string;
    is_active: boolean;

    whatsapp_provider: WhatsAppProvider;
    whatsapp_config: WhatsAppConfig;

    agent_name: string;
    welcome_message: string | null;
    farewell_message: string | null;
    transfer_message: string;
    outside_hours_message: string;

    business_hours: BusinessHours;
    timezone: string;
    attend_outside_hours: boolean;

    ai_model: string;
    ai_temperature: number;
    max_tokens_per_response: number;
    system_prompt_override: string | null;

    qualification_fields: QualificationField[];
    auto_create_contact: boolean;
    auto_create_deal: boolean;
    default_board_id: string | null;
    default_stage_id: string | null;

    transfer_rules: TransferRule[];
    max_messages_before_transfer: number | null;

    max_conversations_simultaneous: number;
    cooldown_after_transfer_minutes: number;

    created_at: string;
    updated_at: string;
}

// ============================================
// Conversations
// ============================================

export type ConversationStatus =
    | 'active'
    | 'waiting_human'
    | 'human_active'
    | 'closed'
    | 'archived';

export type QualificationStatus =
    | 'pending'
    | 'in_progress'
    | 'qualified'
    | 'unqualified';

export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface Conversation {
    id: string;
    organization_id: string;

    whatsapp_number: string;
    whatsapp_name: string | null;
    whatsapp_profile_pic_url: string | null;

    contact_id: string | null;
    deal_id: string | null;

    status: ConversationStatus;
    assigned_agent: string;

    qualification_data: Record<string, unknown>;
    qualification_status: QualificationStatus;
    qualification_score: number | null;

    summary: string | null;
    tags: string[];
    detected_intent: string | null;
    sentiment: Sentiment;

    last_message_at: string | null;
    last_ai_response_at: string | null;
    first_response_time_ms: number | null;
    transferred_at: string | null;
    closed_at: string | null;
    created_at: string;
    updated_at: string;
}

// ============================================
// Messages
// ============================================

export type MessageRole = 'lead' | 'ai' | 'human' | 'system';

export type ContentType =
    | 'text'
    | 'image'
    | 'audio'
    | 'video'
    | 'document'
    | 'location'
    | 'contact'
    | 'sticker';

export type WhatsAppMessageStatus =
    | 'sent'
    | 'delivered'
    | 'read'
    | 'failed';

export interface Message {
    id: string;
    conversation_id: string;
    organization_id: string;

    role: MessageRole;
    sender_id: string | null;
    sender_name: string | null;

    content: string;
    content_type: ContentType;
    media_url: string | null;
    media_mime_type: string | null;

    whatsapp_message_id: string | null;
    whatsapp_status: WhatsAppMessageStatus | null;
    whatsapp_timestamp: string | null;

    ai_model: string | null;
    ai_tokens_input: number | null;
    ai_tokens_output: number | null;
    ai_cost_usd: number | null;
    ai_tools_used: string[];
    ai_reasoning: string | null;

    is_internal_note: boolean;

    created_at: string;
}

// ============================================
// Agent Tools Log
// ============================================

export type AgentToolName =
    | 'create_contact'
    | 'update_contact'
    | 'create_deal'
    | 'move_deal'
    | 'create_activity'
    | 'update_custom_field'
    | 'transfer_to_human'
    | 'qualify_lead'
    | 'search_contacts'
    | 'search_deals'
    | 'property_match'
    | 'check_availability'
    | 'search_knowledge';

export interface AgentToolLog {
    id: string;
    organization_id: string;
    conversation_id: string;
    message_id: string | null;

    tool_name: AgentToolName;
    tool_input: Record<string, unknown>;
    tool_output: Record<string, unknown> | null;
    success: boolean;
    error_message: string | null;

    created_at: string;
}

// ============================================
// Query / Filter helpers
// ============================================

export interface ConversationsFilter {
    status?: ConversationStatus;
    assigned_agent?: string;
    qualification_status?: QualificationStatus;
    search?: string;
}

export interface MessagesFilter {
    conversation_id: string;
    limit?: number;
    before?: string;
}
