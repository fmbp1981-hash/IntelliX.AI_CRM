/**
 * @fileoverview Hooks: Email Campaigns
 *
 * Hooks TanStack Query para campanhas de email.
 * Seguindo padrão SSOT do projeto: setQueryData > invalidateQueries.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { EmailCampaign, CampaignStatus, SegmentFilters } from '@/lib/supabase/email-campaigns';

// ── Query Keys ──────────────────────────────────────────
const campaignKeys = {
    all: ['campaigns'] as const,
    lists: () => [...campaignKeys.all, 'list'] as const,
    list: (status?: CampaignStatus) => [...campaignKeys.lists(), { status }] as const,
    detail: (id: string) => [...campaignKeys.all, 'detail', id] as const,
    segmentPreview: (filters: SegmentFilters) => [...campaignKeys.all, 'segment', filters] as const,
};

// ── useCampaigns — lista campanhas ──────────────────────
export function useCampaigns(status?: CampaignStatus) {
    return useQuery({
        queryKey: campaignKeys.list(status),
        queryFn: async () => {
            const params = status ? `?status=${status}` : '';
            const res = await fetch(`/api/campaigns${params}`);
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch campaigns');
            const data = await res.json();
            return data.campaigns as EmailCampaign[];
        },
        staleTime: 30_000,
    });
}

// ── useCreateCampaign ───────────────────────────────────
export function useCreateCampaign() {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async (payload: { name: string; template_id?: string; segment_filters?: SegmentFilters }) => {
            const res = await fetch('/api/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', ...payload }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to create campaign');
            const data = await res.json();
            return data.campaign as EmailCampaign;
        },
        onSuccess: (campaign) => {
            qc.setQueryData<EmailCampaign[]>(campaignKeys.list(), (prev) =>
                prev ? [campaign, ...prev] : [campaign]
            );
        },
    });
}

// ── useUpdateCampaign ───────────────────────────────────
export function useUpdateCampaign() {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async ({ campaignId, ...updates }: { campaignId: string } & Partial<EmailCampaign>) => {
            const res = await fetch('/api/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update', campaignId, ...updates }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to update campaign');
            const data = await res.json();
            return data.campaign as EmailCampaign;
        },
        onSuccess: (updated) => {
            qc.setQueryData<EmailCampaign[]>(campaignKeys.list(), (prev) =>
                prev?.map(c => c.id === updated.id ? updated : c)
            );
        },
    });
}

// ── useDeleteCampaign ───────────────────────────────────
export function useDeleteCampaign() {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async (campaignId: string) => {
            const res = await fetch('/api/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', campaignId }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to delete campaign');
        },
        onSuccess: (_, campaignId) => {
            qc.setQueryData<EmailCampaign[]>(campaignKeys.list(), (prev) =>
                prev?.filter(c => c.id !== campaignId)
            );
        },
    });
}

// ── useSendCampaign ─────────────────────────────────────
export function useSendCampaign() {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async (campaignId: string) => {
            const res = await fetch(`/api/campaigns/${campaignId}/send`, {
                method: 'POST',
            });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to send campaign');
            return res.json() as Promise<{ sent: number; failed: number; total: number }>;
        },
        onSuccess: (_, campaignId) => {
            // Invalida para refetch com status 'sent' atualizado
            qc.invalidateQueries({ queryKey: campaignKeys.lists() });
            qc.invalidateQueries({ queryKey: campaignKeys.detail(campaignId) });
        },
    });
}

// ── useSegmentPreview ───────────────────────────────────
export function useSegmentPreview(filters: SegmentFilters) {
    return useQuery({
        queryKey: campaignKeys.segmentPreview(filters),
        queryFn: async () => {
            const res = await fetch('/api/campaigns/segment-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filters }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to preview segment');
            return res.json() as Promise<{ count: number; sample: { name: string; email: string }[] }>;
        },
        staleTime: 10_000,
        enabled: true,
    });
}
