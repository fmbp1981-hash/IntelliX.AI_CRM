/**
 * @fileoverview Smart Notifications Service
 * 
 * Módulo 1 do PRD Complementar — Notificações Inteligentes.
 * Gerencia preferências de notificação e envio de notificações in-app.
 * 
 * Canais: in-app (system_notifications), email (Resend quando configurado).
 * Eventos: stagnation, activity_reminder, daily_summary, win_loss, deal_created, deal_stage_changed.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// =============================================
// Types
// =============================================

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
    organization_id: string;
    user_id: string;
    channel: NotificationChannel;
    event_type: NotificationEventType;
    enabled: boolean;
    config: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface CreateNotificationPayload {
    type: string;
    title: string;
    message: string;
    link?: string;
    severity?: 'high' | 'medium' | 'low';
}

export interface NotificationSummary {
    total_unread: number;
    by_severity: { high: number; medium: number; low: number };
    recent: SystemNotification[];
}

export interface SystemNotification {
    id: string;
    organization_id: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    severity: 'high' | 'medium' | 'low';
    read_at: string | null;
    created_at: string;
}

// =============================================
// All supported event types with default configs
// =============================================

export const EVENT_TYPE_CONFIGS: Record<NotificationEventType, {
    label: string;
    description: string;
    defaultEnabled: boolean;
    configSchema?: { key: string; label: string; type: 'number' | 'boolean'; default: any }[];
}> = {
    stagnation: {
        label: 'Deal Estagnado',
        description: 'Alerta quando um deal fica sem atividade por um período.',
        defaultEnabled: true,
        configSchema: [
            { key: 'threshold_days', label: 'Dias sem atividade', type: 'number', default: 7 },
        ],
    },
    activity_reminder: {
        label: 'Lembrete de Atividade',
        description: 'Lembrete antes de reuniões e tarefas agendadas.',
        defaultEnabled: true,
        configSchema: [
            { key: 'minutes_before', label: 'Minutos antes', type: 'number', default: 30 },
        ],
    },
    daily_summary: {
        label: 'Resumo Diário',
        description: 'Briefing matinal com visão geral do dia.',
        defaultEnabled: false,
    },
    win_loss: {
        label: 'Deal Ganho/Perdido',
        description: 'Notificação quando um deal muda para ganho ou perdido.',
        defaultEnabled: true,
    },
    deal_created: {
        label: 'Novo Deal',
        description: 'Notificação quando um novo deal é criado.',
        defaultEnabled: false,
    },
    deal_stage_changed: {
        label: 'Deal Movido',
        description: 'Notificação quando um deal muda de estágio.',
        defaultEnabled: false,
    },
};

// =============================================
// Preferences CRUD
// =============================================

/**
 * Busca todas as preferências de notificação do usuário.
 */
export async function getNotificationPreferences(
    supabase: SupabaseClient,
    userId: string
): Promise<NotificationPreference[]> {
    const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .order('event_type');

    if (error) throw error;
    return data || [];
}

/**
 * Atualiza ou cria uma preferência de notificação.
 */
export async function upsertNotificationPreference(
    supabase: SupabaseClient,
    userId: string,
    organizationId: string,
    params: {
        channel: NotificationChannel;
        event_type: NotificationEventType;
        enabled: boolean;
        config?: Record<string, any>;
    }
): Promise<NotificationPreference> {
    const { data, error } = await supabase
        .from('notification_preferences')
        .upsert(
            {
                user_id: userId,
                organization_id: organizationId,
                channel: params.channel,
                event_type: params.event_type,
                enabled: params.enabled,
                config: params.config || {},
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,channel,event_type' }
        )
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Inicializa preferências padrão para um novo usuário.
 * Cria entries para cada evento com valores default.
 */
export async function initializeDefaultPreferences(
    supabase: SupabaseClient,
    userId: string,
    organizationId: string
): Promise<void> {
    const defaults = Object.entries(EVENT_TYPE_CONFIGS).flatMap(([eventType, config]) => {
        const defaultConfig: Record<string, any> = {};
        config.configSchema?.forEach(field => {
            defaultConfig[field.key] = field.default;
        });

        return [
            {
                user_id: userId,
                organization_id: organizationId,
                channel: 'email' as NotificationChannel,
                event_type: eventType as NotificationEventType,
                enabled: config.defaultEnabled,
                config: defaultConfig,
            },
        ];
    });

    const { error } = await supabase
        .from('notification_preferences')
        .upsert(defaults, { onConflict: 'user_id,channel,event_type' });

    if (error) throw error;
}

// =============================================
// System Notifications (In-App)
// =============================================

/**
 * Cria uma notificação in-app.
 */
export async function createSystemNotification(
    supabase: SupabaseClient,
    organizationId: string,
    payload: CreateNotificationPayload
): Promise<SystemNotification> {
    const { data, error } = await supabase
        .from('system_notifications')
        .insert({
            organization_id: organizationId,
            type: payload.type,
            title: payload.title,
            message: payload.message,
            link: payload.link,
            severity: payload.severity || 'medium',
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Busca notificações do usuário (in-app).
 */
export async function getNotifications(
    supabase: SupabaseClient,
    organizationId: string,
    options?: { unreadOnly?: boolean; limit?: number }
): Promise<SystemNotification[]> {
    let query = supabase
        .from('system_notifications')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(options?.limit ?? 50);

    if (options?.unreadOnly) {
        query = query.is('read_at', null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

/**
 * Marca notificação como lida.
 */
export async function markNotificationRead(
    supabase: SupabaseClient,
    notificationId: string
): Promise<void> {
    const { error } = await supabase
        .from('system_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

    if (error) throw error;
}

/**
 * Marca todas as notificações como lidas.
 */
export async function markAllNotificationsRead(
    supabase: SupabaseClient,
    organizationId: string
): Promise<void> {
    const { error } = await supabase
        .from('system_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('organization_id', organizationId)
        .is('read_at', null);

    if (error) throw error;
}

/**
 * Resumo de notificações para badge/counter.
 */
export async function getNotificationSummary(
    supabase: SupabaseClient,
    organizationId: string
): Promise<NotificationSummary> {
    const { data, error } = await supabase
        .from('system_notifications')
        .select('*')
        .eq('organization_id', organizationId)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) throw error;

    const items = data || [];
    return {
        total_unread: items.length,
        by_severity: {
            high: items.filter(n => n.severity === 'high').length,
            medium: items.filter(n => n.severity === 'medium').length,
            low: items.filter(n => n.severity === 'low').length,
        },
        recent: items.slice(0, 5),
    };
}

// =============================================
// Smart Notification Generation
// =============================================

/**
 * Verifica deals estagnados e gera notificações para os owners.
 * Chamada por pg_cron ou API periodicamente.
 */
export async function generateStagnationNotifications(
    supabase: SupabaseClient,
    organizationId: string
): Promise<number> {
    const defaultThresholdDays = 7;

    // Busca deals ativos sem atividade recente
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - defaultThresholdDays);

    const { data: stagnantDeals, error } = await supabase
        .from('deals')
        .select('id, title, owner_id, value, updated_at')
        .eq('organization_id', organizationId)
        .not('status', 'in', '("won","lost")')
        .lt('updated_at', thresholdDate.toISOString())
        .order('value', { ascending: false })
        .limit(20);

    if (error || !stagnantDeals?.length) return 0;

    let created = 0;

    for (const deal of stagnantDeals) {
        if (!deal.owner_id) continue;

        // Check if user wants stagnation notifications
        const { data: pref } = await supabase
            .from('notification_preferences')
            .select('enabled')
            .eq('user_id', deal.owner_id)
            .eq('event_type', 'stagnation')
            .eq('channel', 'email')
            .single();

        // If no preference exists or is enabled, send notification
        if (!pref || pref.enabled !== false) {
            const daysSinceUpdate = Math.floor(
                (Date.now() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24)
            );

            await createSystemNotification(supabase, organizationId, {
                type: 'stagnation',
                title: `Deal "${deal.title}" está parado há ${daysSinceUpdate} dias`,
                message: `O deal ${deal.title} (R$ ${(deal.value || 0).toLocaleString('pt-BR')}) não recebe atividade há ${daysSinceUpdate} dias. Considere agendar follow-up.`,
                link: `/deals/${deal.id}`,
                severity: daysSinceUpdate > 14 ? 'high' : 'medium',
            });

            created++;
        }
    }

    return created;
}

/**
 * Gera lembretes de atividades agendadas para as próximas horas.
 */
export async function generateActivityReminders(
    supabase: SupabaseClient,
    organizationId: string
): Promise<number> {
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const { data: upcoming, error } = await supabase
        .from('activities')
        .select('id, title, type, scheduled_date, user_id')
        .eq('organization_id', organizationId)
        .eq('status', 'scheduled')
        .gte('scheduled_date', now.toISOString())
        .lte('scheduled_date', twoHoursFromNow.toISOString())
        .order('scheduled_date');

    if (error || !upcoming?.length) return 0;

    let created = 0;

    for (const activity of upcoming) {
        const scheduledTime = new Date(activity.scheduled_date);
        const minutesUntil = Math.round(
            (scheduledTime.getTime() - now.getTime()) / (1000 * 60)
        );

        const typeLabels: Record<string, string> = {
            meeting: '📅 Reunião',
            call: '📞 Ligação',
            task: '✅ Tarefa',
            email: '✉️ Email',
        };

        const typeLabel = typeLabels[activity.type] || activity.type;

        await createSystemNotification(supabase, organizationId, {
            type: 'activity_reminder',
            title: `${typeLabel} em ${minutesUntil} minutos`,
            message: activity.title,
            link: `/activities/${activity.id}`,
            severity: minutesUntil <= 15 ? 'high' : 'low',
        });

        created++;
    }

    return created;
}
