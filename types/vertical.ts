/**
 * @fileoverview Types for the Vertical Multi-Niche system (Business Profile Layer).
 *
 * These types describe the configuration data stored in `vertical_configs`
 * and the EAV pattern used for custom field values.
 *
 * @module types/vertical
 */

// =============================================================================
// Business Type Enum
// =============================================================================

export type BusinessType = 'generic' | 'medical_clinic' | 'dental_clinic' | 'real_estate';

// =============================================================================
// Display Config (nomenclaturas)
// =============================================================================

export interface VerticalDisplayConfig {
    deal_label: string;
    deal_label_plural: string;
    contact_label: string;
    contact_label_plural: string;
    pipeline_label: string;
    activity_label: string;
    company_label: string;
    won_label: string;
    lost_label: string;
}

// =============================================================================
// Custom Fields Schema
// =============================================================================

export type CustomFieldUIType =
    | 'text'
    | 'textarea'
    | 'number'
    | 'date'
    | 'datetime'
    | 'boolean'
    | 'select'
    | 'multi_select'
    | 'currency'
    | 'decimal'
    | 'fk';

export interface CustomFieldSchema {
    key: string;
    label: string;
    type: CustomFieldUIType;
    required?: boolean;
    options?: string[];
    options_configurable?: boolean;
    source?: 'team_members';
    currency?: string;
    placeholder?: string;
    min?: number;
    max?: number;
    auto_fill?: boolean;
    encrypted?: boolean;
    computed?: boolean;
    computed_by?: 'ai';
    references?: string;
}

export interface CustomFieldsSchemaMap {
    contact: CustomFieldSchema[];
    deal: CustomFieldSchema[];
}

// =============================================================================
// Pipeline Template
// =============================================================================

export interface PipelineStageTemplate {
    order: number;
    name: string;
    color: string;
    automation?: string;
}

// =============================================================================
// Automations
// =============================================================================

export interface AutomationRule {
    enabled: boolean;
    trigger: string;
    action: string;
    delay_hours?: number;
    delay_days?: number;
}

// =============================================================================
// AI Context
// =============================================================================

export interface PriorityWeights {
    financial_value: number;
    idle_days: number;
    ai_probability: number;
    temporal_urgency: number;
    recurrence_retention: number;
}

export interface AIContext {
    system_prompt_vertical: string;
    action_prompts: Record<string, string>;
    priority_weights: PriorityWeights;
}

// =============================================================================
// Dashboard Widgets
// =============================================================================

export interface DashboardWidget {
    type: 'kpi' | 'kpi_list' | 'kpi_alert' | 'kpi_breakdown' | 'list' | 'donut' | 'bar' | 'progress' | 'timeline';
    key: string;
    label: string;
    calc?: string;
}

// =============================================================================
// Inbox Rules
// =============================================================================

export interface InboxRules {
    stagnation_days?: number;
    reactivation_months?: number;
    absenteeism_alert_threshold?: number;
    budget_followup_days?: number;
    maintenance_months?: number;
    visit_followup_days?: number;
    proposal_followup_days?: number;
    matching_interval_hours?: number;
}

// =============================================================================
// Feature Flags
// =============================================================================

export interface VerticalFeatureFlags {
    pipeline_kanban: boolean;
    contacts_management: boolean;
    inbox_intelligent: boolean;
    ai_central: boolean;
    custom_fields: boolean;
    scheduling_calendar: boolean;
    absenteeism_tracking: boolean;
    insurance_management: boolean;
    budget_pipeline: boolean;
    installment_tracking: boolean;
    treatment_progress: boolean;
    maintenance_recurrence: boolean;
    property_management: boolean;
    client_property_match: boolean;
    visit_management: boolean;
    commission_tracking: boolean;
    broker_view: boolean;
}

// =============================================================================
// Root Type: VerticalConfig
// =============================================================================

export interface VerticalConfig {
    id: string;
    business_type: BusinessType;
    display_config: VerticalDisplayConfig;
    custom_fields_schema: CustomFieldsSchemaMap;
    default_pipeline_template: PipelineStageTemplate[];
    default_automations: Record<string, AutomationRule>;
    ai_context: AIContext;
    dashboard_widgets: DashboardWidget[];
    inbox_rules: InboxRules;
    feature_flags: VerticalFeatureFlags;
    created_at: string;
    updated_at: string;
}

// =============================================================================
// Custom Field Value (EAV row)
// =============================================================================

export interface CustomFieldValue {
    id: string;
    organization_id: string;
    entity_type: 'contact' | 'deal' | 'activity';
    entity_id: string;
    field_key: string;
    field_value: unknown; // JSONB — string, number, boolean, array
    created_at: string;
    updated_at: string;
}

// =============================================================================
// Vertical Property (Real Estate)
// =============================================================================

export type PropertyType = 'apartamento' | 'casa' | 'comercial' | 'terreno';
export type TransactionType = 'venda' | 'locacao' | 'venda_e_locacao';
export type PropertyStatus = 'disponivel' | 'reservado' | 'vendido' | 'locado';

export interface PropertyAddress {
    rua?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
}

export interface VerticalProperty {
    id: string;
    organization_id: string;
    property_type: PropertyType;
    transaction_type: TransactionType;
    address_json: PropertyAddress;
    value?: number;
    area_m2?: number;
    bedrooms?: number;
    status: PropertyStatus;
    owner_contact_id?: string;
    assigned_broker_id?: string;
    features_json: string[];
    photos_urls: string[];
    created_at: string;
    updated_at: string;
}
