/**
 * @fileoverview React Hooks: Activity Sequences
 * 
 * Hooks para gerenciar sequências de follow-up e enrollments.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { createClient } from '@/lib/supabase/client';
import {
    getSequences,
    createSequence,
    updateSequence,
    deleteSequence,
    enrollDealInSequence,
    getDealEnrollments,
    cancelEnrollment,
    pauseEnrollment,
    resumeEnrollment,
    type CreateSequencePayload,
} from '@/lib/supabase/sequences';

/**
 * Hook para listar sequências da organização.
 */
export function useSequences(activeOnly = false) {
    const supabase = createClient();

    return useQuery({
        queryKey: activeOnly ? queryKeys.activitySequences.active() : queryKeys.activitySequences.all,
        queryFn: async () => {
            if (!supabase) throw new Error('Supabase client not initialized');
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user.id)
                .single();

            if (!profile) throw new Error('Profile not found');
            return getSequences(supabase, profile.organization_id, { activeOnly });
        },
        staleTime: 60_000,
    });
}

/**
 * Hook para criar uma sequência.
 */
export function useCreateSequence() {
    const queryClient = useQueryClient();
    const supabase = createClient();

    return useMutation({
        mutationFn: async (payload: CreateSequencePayload) => {
            if (!supabase) throw new Error('Supabase client not initialized');
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { data: profile } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('id', user.id)
                .single();

            if (!profile) throw new Error('Profile not found');
            return createSequence(supabase, profile.organization_id, user.id, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.activitySequences.all });
        },
    });
}

/**
 * Hook para atualizar uma sequência.
 */
export function useUpdateSequence() {
    const queryClient = useQueryClient();
    const supabase = createClient();

    return useMutation({
        mutationFn: async (params: { id: string } & Partial<CreateSequencePayload>) => {
            if (!supabase) throw new Error('Supabase client not initialized');
            const { id, ...payload } = params;
            return updateSequence(supabase, id, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.activitySequences.all });
        },
    });
}

/**
 * Hook para deletar uma sequência.
 */
export function useDeleteSequence() {
    const queryClient = useQueryClient();
    const supabase = createClient();

    return useMutation({
        mutationFn: async (sequenceId: string) => {
            if (!supabase) throw new Error('Supabase client not initialized');
            return deleteSequence(supabase, sequenceId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.activitySequences.all });
        },
    });
}

/**
 * Hook para inscrever deal em uma sequência.
 */
export function useEnrollDeal() {
    const queryClient = useQueryClient();
    const supabase = createClient();

    return useMutation({
        mutationFn: async (params: { dealId: string; sequenceId: string }) => {
            if (!supabase) throw new Error('Supabase client not initialized');
            return enrollDealInSequence(supabase, params.dealId, params.sequenceId);
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.dealEnrollments.byDeal(variables.dealId),
            });
        },
    });
}

/**
 * Hook para buscar enrollments de um deal.
 */
export function useDealEnrollments(dealId: string) {
    const supabase = createClient();

    return useQuery({
        queryKey: queryKeys.dealEnrollments.byDeal(dealId),
        queryFn: () => {
            if (!supabase) throw new Error('Supabase client not initialized');
            return getDealEnrollments(supabase, dealId);
        },
        enabled: !!dealId,
        staleTime: 30_000,
    });
}

/**
 * Hook para cancelar enrollment.
 */
export function useCancelEnrollment() {
    const queryClient = useQueryClient();
    const supabase = createClient();

    return useMutation({
        mutationFn: async (enrollmentId: string) => {
            if (!supabase) throw new Error('Supabase client not initialized');
            return cancelEnrollment(supabase, enrollmentId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.dealEnrollments.all });
        },
    });
}

/**
 * Hook para pausar/resumir enrollment.
 */
export function useToggleEnrollmentPause() {
    const queryClient = useQueryClient();
    const supabase = createClient();

    return useMutation({
        mutationFn: async (params: { enrollmentId: string; isPaused: boolean }) => {
            if (!supabase) throw new Error('Supabase client not initialized');
            if (params.isPaused) {
                return resumeEnrollment(supabase, params.enrollmentId);
            } else {
                return pauseEnrollment(supabase, params.enrollmentId);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.dealEnrollments.all });
        },
    });
}
