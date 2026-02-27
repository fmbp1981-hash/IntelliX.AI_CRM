/**
 * @fileoverview React Hooks: AI Governance
 * 
 * Hooks para o dashboard de governança de IA.
 * Consome `/api/ai/usage` para métricas e quota status.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { createClient } from '@/lib/supabase/client';
import type { AIUsageStats, AIQuotaStatus } from '@/lib/supabase/ai-governance';

/**
 * Hook para obter estatísticas de uso de IA.
 */
export function useAIUsageStats(period: 'day' | 'week' | 'month' = 'month') {
    return useQuery({
        queryKey: queryKeys.aiUsage.stats(period),
        queryFn: async (): Promise<AIUsageStats> => {
            const res = await fetch(`/api/ai/usage?period=${period}`, {
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to fetch AI usage stats');
            const data = await res.json();
            return data.stats;
        },
        staleTime: 30_000,
    });
}

/**
 * Hook para obter o status da quota de IA.
 */
export function useAIQuotaStatus() {
    return useQuery({
        queryKey: queryKeys.aiQuotas.all,
        queryFn: async (): Promise<AIQuotaStatus | null> => {
            const res = await fetch('/api/ai/usage?view=quota', {
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to fetch AI quota status');
            const data = await res.json();
            return data.quota;
        },
        staleTime: 60_000,
    });
}

/**
 * Hook para atualizar a configuração de quota de IA (admin only).
 */
export function useUpdateAIQuota() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: {
            monthly_token_limit: number;
            reset_day: number;
            alert_threshold_pct: number;
        }) => {
            const supabase = createClient();
            if (!supabase) throw new Error('Supabase client not initialized');
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id, role')
                .eq('id', user.id)
                .single();

            if (!profile || profile.role !== 'admin') {
                throw new Error('Apenas administradores podem alterar quotas');
            }

            const { error } = await supabase
                .from('ai_quotas')
                .upsert({
                    organization_id: profile.organization_id,
                    monthly_token_limit: params.monthly_token_limit,
                    reset_day: params.reset_day,
                    alert_threshold_pct: params.alert_threshold_pct,
                }, { onConflict: 'organization_id' });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.aiQuotas.all });
        },
    });
}
