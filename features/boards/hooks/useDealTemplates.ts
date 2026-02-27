/**
 * @fileoverview React Hooks: Deal Templates
 * 
 * Hooks para gerenciar templates de deals.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import type { DealTemplate, CreateTemplatePayload } from '@/lib/supabase/deal-templates';

/**
 * Hook para listar templates.
 */
export function useDealTemplates(boardId?: string, activeOnly = false) {
    return useQuery<DealTemplate[]>({
        queryKey: boardId
            ? queryKeys.dealTemplates.byBoard(boardId)
            : activeOnly
                ? queryKeys.dealTemplates.active()
                : queryKeys.dealTemplates.all,
        queryFn: async () => {
            const params = new URLSearchParams();
            if (boardId) params.set('board_id', boardId);
            if (activeOnly) params.set('active', 'true');

            const res = await fetch(`/api/deal-templates?${params}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch templates');
            const data = await res.json();
            return data.templates;
        },
        staleTime: 60_000,
    });
}

/**
 * Hook para criar template.
 */
export function useCreateDealTemplate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: CreateTemplatePayload) => {
            const res = await fetch('/api/deal-templates', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', ...payload }),
            });
            if (!res.ok) throw new Error('Failed to create template');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.dealTemplates.all });
        },
    });
}

/**
 * Hook para aplicar template (criar deal a partir dele).
 */
export function useApplyDealTemplate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (params: {
            templateId: string;
            overrides?: Record<string, any>;
        }) => {
            const res = await fetch('/api/deal-templates', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'apply', ...params }),
            });
            if (!res.ok) throw new Error('Failed to apply template');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
        },
    });
}

/**
 * Hook para deletar template.
 */
export function useDeleteDealTemplate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (templateId: string) => {
            const res = await fetch('/api/deal-templates', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', templateId }),
            });
            if (!res.ok) throw new Error('Failed to delete template');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.dealTemplates.all });
        },
    });
}
