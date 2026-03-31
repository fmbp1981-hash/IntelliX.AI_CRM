// types/agent.ts — NossoAgent core types

// ============================================
// Agent Personalization — Deep Config
// ============================================

export type SalesMethodology =
    | 'bant'
    | 'spin'
    | 'meddic'
    | 'gpct'
    | 'flavio_augusto'
    | 'neurovendas'
    | 'consultivo'
    | 'hybrid'
    | 'custom';

export type TonePreset =
    | 'formal'
    | 'profissional'
    | 'consultivo'
    | 'empático'
    | 'casual'
    | 'técnico'
    | 'inspirador'
    | 'custom';

export type EmojiLevel = 'none' | 'minimal' | 'moderate' | 'expressive';
export type MessageLength = 'very_short' | 'short' | 'medium' | 'detailed';
export type YouForm = 'você' | 'tu' | 'senhor/senhora';

export interface FewShotExample {
    user_message: string;
    agent_response: string;
    context?: string;
    rationale?: string;
}

export interface AgentPersona {
    agent_name?: string;
    agent_role_description?: string;
    backstory?: string;
    avatar_emoji?: string;
    // Aliases used by UI components and prompt-builder
    name?: string;
    role_description?: string;
    communication_style?: string;
    avatar_description?: string;
}

export interface ToneOfVoice {
    preset: TonePreset;
    custom_description?: string;
    language_style: {
        use_you_form?: YouForm;
        emoji_level?: EmojiLevel;
        message_length?: MessageLength;
        formality?: 1 | 2 | 3 | 4 | 5 | string;
        // Extended fields used by UI and prompt-builder
        energy?: string;
        empathy_level?: string;
        use_emojis?: boolean;
    };
    words_to_use: string[];
    words_to_avoid: string[];
    few_shot_examples: FewShotExample[];
}

export interface ObjectionEntry {
    objection: string;
    response_strategy: string;
    example_response: string;
}

export interface SalesMethodologyConfig {
    primary: SalesMethodology;
    secondary?: SalesMethodology[] | string;
    qualification_priority?: string[];
    objection_library?: ObjectionEntry[];
    closing_style?: 'assumptive' | 'question' | 'urgency' | 'summary' | 'trial';
    follow_up_style?: 'high_frequency' | 'value_based' | 'minimal';
    custom_approach?: string;
}

export type KnowledgeSourceType =
    | 'document'
    | 'faq'
    | 'product_catalog'
    | 'pricing'
    | 'procedures'
    | 'policies'
    | 'competitors'
    | 'custom';

export interface KnowledgeSource {
    id: string;
    name: string;
    type: KnowledgeSourceType;
    content_summary: string;
    is_active: boolean;
    priority: number;
    // Extended fields used by AgentKnowledgeTab UI
    reference?: string;
    description?: string;
}

export interface KnowledgeBaseConfig {
    sources: KnowledgeSource[];
    search_threshold: number;
    max_results_per_query: number;
    always_search_before_respond: boolean;
}

export interface ProductService {
    name: string;
    description: string;
    price_range?: string;
    main_benefits: string[];
    target_customer: string;
}

export interface TargetAudience {
    description: string;
    pain_points: string[];
    desires: string[];
    language: string;
    // Extended fields used by prompt-builder
    age_range?: string;
    income_level?: string;
    main_pains?: string[];
}

export interface CompetitorInfo {
    name: string;
    how_to_handle: string;
}

export interface BusinessContextExtended {
    company_name?: string;
    company_description?: string;
    key_products_services: ProductService[];
    unique_value_propositions: string[];
    target_audience?: TargetAudience;
    competitors: CompetitorInfo[];
    important_rules: string[];
    seasonal_context?: string;
}

export interface SuccessStory {
    context: string;
    outcome: string;
}

export interface BehavioralTraining {
    do_list: string[];
    dont_list: string[];
    escalation_triggers: string[];
    conversation_starters: string[];
    success_stories: SuccessStory[];
}

export interface FollowUpMessage {
    delay_hours: number;
    content: string;
    goal: string;
}

export interface FollowUpSequence {
    trigger: string;
    messages: FollowUpMessage[];
    max_attempts: number;
    exit_conditions: string[];
    // Extended fields used by prompt-builder
    name?: string;
    trigger_event?: string;
    steps?: FollowUpMessage[];
}

export interface FollowUpConfig {
    sequences: FollowUpSequence[];
    cac_zero_script: string;
}

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

    business_profile: Record<string, any>;

    // ── Deep Personalization (v2 — Multi-Agent Methodology System) ──
    persona: AgentPersona | null;
    tone_of_voice: ToneOfVoice | null;
    sales_methodology: SalesMethodologyConfig | null;
    knowledge_base_config: KnowledgeBaseConfig | null;
    business_context_extended: BusinessContextExtended | null;
    behavioral_training: BehavioralTraining | null;
    follow_up_config: FollowUpConfig | null;

    created_at: string;
    updated_at: string;
}

// ── Agent Methodology Templates ──────────────────────────────────

export interface AgentMethodologyTemplate {
    id: string;
    name: string;
    display_name: string;
    description: string | null;
    vertical: string | null;
    agent_role: string;
    methodology: SalesMethodology;
    system_prompt: string;
    qualification_fields: QualificationField[];
    objection_scripts: ObjectionEntry[];
    follow_up_sequences: FollowUpSequence[];
    default_tone_preset: TonePreset;
    tags: string[];
    is_active: boolean;
    sort_order: number;
    created_at: string;
}

// ── Agent Board & Stage Configs ───────────────────────────────────

export type AgentMode = 'auto' | 'template' | 'learn' | 'advanced';

export interface AgentBoardConfig {
    id: string;
    organization_id: string;
    board_id: string;
    agent_mode: AgentMode;
    methodology_template_id: string | null;
    agent_role: string;
    system_prompt_override: string | null;
    personalization_override: Partial<AgentConfig>;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface AgentStageConfig {
    id: string;
    organization_id: string;
    board_id: string;
    stage_id: string;
    agent_role: string | null;
    system_prompt_override: string | null;
    qualification_criteria: Record<string, unknown>;
    auto_advance: boolean;
    trigger_actions: unknown[];
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

export type Sentiment = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';

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
    sentiment_score: number;
    sentiment_history: import('./customer-intelligence').SentimentEntry[];

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
    | 'search_knowledge'
    | 'schedule_followup'
    | 'cancel_followup';

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
