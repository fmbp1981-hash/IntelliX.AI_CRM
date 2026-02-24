/**
 * @fileoverview React Hooks: Inbox Action Items
 * 
 * Hooks para gerenciar os action items do Inbox Inteligente 2.0.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { createClient } from '@/lib/supabase/client';
import {
    getActionItems,
    completeActionItem,
    dismissActionItem,
    snoozeActionItem,
    getUserStreak,
    type ActionItemStatus,
} from '@/lib/supabase/inbox-actions';

/**
 * Hook para buscar action items do inbox.
 */
export function useActionItems(status: ActionItemStatus = 'pending') {
    const supabase = createClient();

    return useQuery({
        queryKey: [...queryKeys.inboxItems.all, status],
        queryFn: async () => {
            if (!supabase) throw new Error('Supabase client not initialized');
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');
            return getActionItems(supabase, user.id, { status });
        },
        staleTime: 30_000,
    });
}

/**
 * Hook para completar um action item.
 */
export function useCompleteAction() {
    const queryClient = useQueryClient();
    const supabase = createClient();

    return useMutation({
        mutationFn: async (itemId: string) => {
            if (!supabase) throw new Error('Supabase client not initialized');
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');
            await completeActionItem(supabase, itemId, user.id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inboxItems.all });
        },
    });
}

/**
 * Hook para dismissir um action item.
 */
export function useDismissAction() {
    const queryClient = useQueryClient();
    const supabase = createClient();

    return useMutation({
        mutationFn: async (itemId: string) => {
            if (!supabase) throw new Error('Supabase client not initialized');
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');
            await dismissActionItem(supabase, itemId, user.id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inboxItems.all });
        },
    });
}

/**
 * Hook para adiar (snooze) um action item.
 */
export function useSnoozeAction() {
    const queryClient = useQueryClient();
    const supabase = createClient();

    return useMutation({
        mutationFn: async (params: { itemId: string; snoozeUntil: Date }) => {
            if (!supabase) throw new Error('Supabase client not initialized');
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');
            await snoozeActionItem(supabase, params.itemId, user.id, params.snoozeUntil);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inboxItems.all });
        },
    });
}

/**
 * Hook para gerar novos action items via IA.
 */
export function useGenerateActions() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/ai/inbox-generate', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error || 'Falha ao gerar ações');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inboxItems.all });
        },
    });
}

/**
 * Hook para obter o streak do usuário.
 */
export function useUserStreak() {
    const supabase = createClient();

    return useQuery({
        queryKey: [...queryKeys.inboxItems.all, 'streak'],
        queryFn: async () => {
            if (!supabase) throw new Error('Supabase client not initialized');
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');
            return getUserStreak(supabase, user.id);
        },
        staleTime: 60_000,
    });
}
