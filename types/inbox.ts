/**
 * Inbox Action Items Types
 * PRD Complementar NossoCRM v1 - Inbox 2.0
 */

/**
 * Tipo de ação do item do inbox
 */
export type InboxActionType =
    | 'call'
    | 'email'
    | 'move_stage'
    | 'schedule_meeting'
    | 'custom';

/**
 * Item de ação do Inbox Inteligente 2.0
 * Representa uma ação priorizada que o usuário deve executar
 */
export interface InboxActionItem {
    id: string;
    organizationId: string;
    userId: string;
    dealId: string | null;
    contactId: string | null;
    type: InboxActionType;
    title: string;
    reason: string | null;
    priority: number; // 1-100 (maior = mais urgente)
    suggestedScript: string | null;
    completed: boolean;
    completedAt: string | null;
    snoozedUntil: string | null;
    dismissed: boolean;
    createdAt: string;

    // Dados desnormalizados para UI (joins)
    deal?: {
        id: string;
        title: string;
        value: number | null;
        lastStageChangeDate: string | null;
    };
    contact?: {
        id: string;
        name: string;
    };
}

/**
 * Dados calculados para exibição
 */
export interface InboxActionItemView extends InboxActionItem {
    stagnationDays?: number;
    dealValue?: number;
    contactName?: string;
    dealTitle?: string;
}

/**
 * Payload para criar um novo action item
 */
export interface CreateInboxActionItemPayload {
    dealId?: string;
    contactId?: string;
    type: InboxActionType;
    title: string;
    reason?: string;
    priority?: number;
    suggestedScript?: string;
}

/**
 * Preferências de notificação
 */
export type NotificationChannel = 'email' | 'webhook' | 'push';

export type NotificationEventType =
    | 'stagnation'
    | 'activity_reminder'
    | 'daily_summary'
    | 'win_loss'
    | 'deal_created'
    | 'deal_stage_changed';

export interface NotificationPreference {
    id: string;
    organizationId: string;
    userId: string;
    channel: NotificationChannel;
    eventType: NotificationEventType;
    enabled: boolean;
    config: {
        stagnationDays?: number;
        reminderMinutes?: number;
        summaryTime?: string; // "08:00"
        webhookUrl?: string;
    };
    createdAt: string;
    updatedAt: string;
}

/**
 * Template de Deal
 */
export interface DealTemplate {
    id: string;
    organizationId: string;
    boardId: string | null;
    name: string;
    description: string | null;
    defaults: {
        title?: string; // suporta placeholders {{contact.name}}
        value?: number;
        priority?: 'low' | 'medium' | 'high';
        probability?: number;
        items?: Array<{
            description: string;
            quantity: number;
            unitPrice: number;
        }>;
        tags?: string[];
        customFields?: Record<string, unknown>;
    };
    createdBy: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

/**
 * Sequência de atividades (Cadência)
 */
export interface ActivitySequenceStep {
    order: number;
    activityType: 'CALL' | 'EMAIL' | 'MEETING' | 'TASK';
    title: string;
    description?: string;
    delayDays: number; // dias após step anterior (ou após início)
    delayHours?: number;
}

export interface ActivitySequence {
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    steps: ActivitySequenceStep[];
    triggerStageId: string | null; // auto-aplicar quando deal entra
    isActive: boolean;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
}

/**
 * Enrollment de deal em sequência
 */
export type DealSequenceStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface DealSequenceEnrollment {
    id: string;
    dealId: string;
    sequenceId: string;
    currentStep: number;
    status: DealSequenceStatus;
    startedAt: string;
    nextActivityDate: string | null;
    completedAt: string | null;
}

/**
 * AI Usage e Quotas
 */
export type AIProvider = 'gemini' | 'openai' | 'anthropic';

export interface AIUsageLog {
    id: string;
    organizationId: string;
    userId: string | null;
    provider: AIProvider;
    model: string;
    toolName: string | null;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    createdAt: string;
}

export interface AIQuota {
    organizationId: string;
    monthlyTokenLimit: number;
    tokensUsedThisMonth: number;
    resetDay: number;
    alertThresholdPercent: number;
    lastResetAt: string;
    createdAt: string;
    updatedAt: string;
}

export interface AIQuotaStatus {
    allowed: boolean;
    used: number;
    limit: number;
    percentUsed: number;
    alertTriggered: boolean;
}

export interface AIUsageStats {
    totalTokens: number;
    estimatedCost: number;
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
}
