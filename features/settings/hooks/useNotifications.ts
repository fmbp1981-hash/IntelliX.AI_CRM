/**
 * @fileoverview React Hooks: Notifications
 * 
 * Hooks para notificações in-app e preferências de notificação.
 */

'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/queryKeys';
import type {
    NotificationPreference,
    NotificationChannel,
    NotificationEventType,
    NotificationSummary,
    SystemNotification,
} from '@/lib/supabase/notifications';

/**
 * Hook para buscar notificações in-app.
 */
export function useNotifications(unreadOnly = false) {
    return useQuery<SystemNotification[]>({
        queryKey: ['notifications', unreadOnly ? 'unread' : 'all'],
        queryFn: async () => {
            const res = await fetch(
                `/api/notifications?unread=${unreadOnly}`,
                { credentials: 'include' }
            );
            if (!res.ok) throw new Error('Failed to fetch notifications');
            const data = await res.json();
            return data.notifications;
        },
        staleTime: 30_000,
        refetchInterval: 60_000, // Refresh every minute
    });
}

/**
 * Hook para resumo de notificações (badge counter).
 */
export function useNotificationSummary() {
    return useQuery<NotificationSummary>({
        queryKey: ['notifications', 'summary'],
        queryFn: async () => {
            const res = await fetch('/api/notifications?view=summary', { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch summary');
            const data = await res.json();
            return data.summary;
        },
        staleTime: 30_000,
        refetchInterval: 60_000,
    });
}

/**
 * Hook para marcar notificação como lida.
 */
export function useMarkNotificationRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (notificationId: string) => {
            const res = await fetch('/api/notifications', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'read', notificationId }),
            });
            if (!res.ok) throw new Error('Failed to mark as read');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
}

/**
 * Hook para marcar todas como lidas.
 */
export function useMarkAllRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/notifications', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'read-all' }),
            });
            if (!res.ok) throw new Error('Failed to mark all as read');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
}

/**
 * Hook para preferências de notificação.
 */
export function useNotificationPreferences() {
    return useQuery<NotificationPreference[]>({
        queryKey: queryKeys.notificationPreferences.all,
        queryFn: async () => {
            const res = await fetch('/api/notifications/preferences', { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch preferences');
            const data = await res.json();
            return data.preferences;
        },
        staleTime: 60_000,
    });
}

/**
 * Hook para atualizar uma preferência.
 */
export function useUpdateNotificationPreference() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (params: {
            channel: NotificationChannel;
            event_type: NotificationEventType;
            enabled: boolean;
            config?: Record<string, any>;
        }) => {
            const res = await fetch('/api/notifications/preferences', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
            });
            if (!res.ok) throw new Error('Failed to update preference');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences.all });
        },
    });
}

/**
 * Hook para subscrever aos eventos do Supabase Realtime
 * nas notificações do sistema. Invalida as queries quando houver mudança.
 */
export function useSystemNotificationsRealtime() {
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase
            .channel('system_notifications_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'system_notifications',
                },
                (_payload) => {
                    // Invalida a query base para buscar novas notificações e refletir badges
                    queryClient.invalidateQueries({ queryKey: ['notifications'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);
}
