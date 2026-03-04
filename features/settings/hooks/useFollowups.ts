/**
 * @fileoverview React Hooks: Follow-up Sequences & Executions
 *
 * TanStack Query hooks for managing follow-up sequences and their executions.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import type { FollowupSequence, FollowupExecution, CreateSequencePayload, CreateExecutionPayload } from '@/lib/supabase/followups';

// =============================================
// Sequences
// =============================================

export function useFollowupSequences(options?: { type?: string; activeOnly?: boolean }) {
    return useQuery<FollowupSequence[]>({
        queryKey: options?.type
            ? queryKeys.followupSequences.byType(options.type)
            : queryKeys.followupSequences.all,
        queryFn: async () => {
            const params = new URLSearchParams();
            if (options?.type) params.set('type', options.type);
            if (options?.activeOnly) params.set('active', 'true');

            const res = await fetch(`/api/followups?${params}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch sequences');
            const data = await res.json();
            return data.sequences;
        },
        staleTime: 60_000,
    });
}

export function useCreateFollowupSequence() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: CreateSequencePayload) => {
            const res = await fetch('/api/followups', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', ...payload }),
            });
            if (!res.ok) throw new Error('Failed to create sequence');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.followupSequences.all });
        },
    });
}

export function useUpdateFollowupSequence() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (params: { sequenceId: string } & Partial<CreateSequencePayload> & { is_active?: boolean }) => {
            const res = await fetch('/api/followups', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update', ...params }),
            });
            if (!res.ok) throw new Error('Failed to update sequence');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.followupSequences.all });
        },
    });
}

export function useDeleteFollowupSequence() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (sequenceId: string) => {
            const res = await fetch('/api/followups', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', sequenceId }),
            });
            if (!res.ok) throw new Error('Failed to delete sequence');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.followupSequences.all });
        },
    });
}

// =============================================
// Executions
// =============================================

export function useFollowupExecutions(options?: { status?: string; conversationId?: string; dealId?: string }) {
    return useQuery<FollowupExecution[]>({
        queryKey: options?.conversationId
            ? queryKeys.followupExecutions.byConversation(options.conversationId)
            : options?.dealId
                ? queryKeys.followupExecutions.byDeal(options.dealId)
                : queryKeys.followupExecutions.all,
        queryFn: async () => {
            const params = new URLSearchParams();
            if (options?.status) params.set('status', options.status);
            if (options?.conversationId) params.set('conversation_id', options.conversationId);
            if (options?.dealId) params.set('deal_id', options.dealId);

            const res = await fetch(`/api/followups/executions?${params}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch executions');
            const data = await res.json();
            return data.executions;
        },
        staleTime: 30_000,
    });
}

export function useCreateFollowupExecution() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: CreateExecutionPayload) => {
            const res = await fetch('/api/followups/executions', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', ...payload }),
            });
            if (!res.ok) throw new Error('Failed to create execution');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.followupExecutions.all });
        },
    });
}

export function useCancelFollowupExecution() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (params: { executionId: string; reason?: string }) => {
            const res = await fetch('/api/followups/executions', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancel', ...params }),
            });
            if (!res.ok) throw new Error('Failed to cancel execution');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.followupExecutions.all });
        },
    });
}

export function usePauseFollowupExecution() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (executionId: string) => {
            const res = await fetch('/api/followups/executions', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'pause', executionId }),
            });
            if (!res.ok) throw new Error('Failed to pause execution');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.followupExecutions.all });
        },
    });
}

export function useResumeFollowupExecution() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (executionId: string) => {
            const res = await fetch('/api/followups/executions', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'resume', executionId }),
            });
            if (!res.ok) throw new Error('Failed to resume execution');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.followupExecutions.all });
        },
    });
}
