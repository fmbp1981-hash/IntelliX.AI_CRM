/**
 * @fileoverview Hooks: Email Templates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { EmailTemplate } from '@/lib/supabase/email-campaigns';

const templateKeys = {
    all: ['email-templates'] as const,
    list: () => [...templateKeys.all, 'list'] as const,
};

export function useEmailTemplates() {
    return useQuery({
        queryKey: templateKeys.list(),
        queryFn: async () => {
            const res = await fetch('/api/campaigns/templates');
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch templates');
            const data = await res.json();
            return data.templates as EmailTemplate[];
        },
        staleTime: 60_000,
    });
}

export function useCreateEmailTemplate() {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async (payload: {
            name: string;
            subject: string;
            html_body: string;
            text_body?: string;
            preview_text?: string;
        }) => {
            const res = await fetch('/api/campaigns/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', ...payload }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to create template');
            const data = await res.json();
            return data.template as EmailTemplate;
        },
        onSuccess: (template) => {
            qc.setQueryData<EmailTemplate[]>(templateKeys.list(), (prev) =>
                prev ? [template, ...prev] : [template]
            );
        },
    });
}

export function useDeleteEmailTemplate() {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async (templateId: string) => {
            const res = await fetch('/api/campaigns/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', templateId }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to delete template');
        },
        onSuccess: (_, templateId) => {
            qc.setQueryData<EmailTemplate[]>(templateKeys.list(), (prev) =>
                prev?.filter(t => t.id !== templateId)
            );
        },
    });
}

export function useGenerateEmailTemplate() {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async (payload: {
            objective: string;
            targetSegment?: string;
            tone?: string;
            vertical?: string;
            templateName?: string;
        }) => {
            const res = await fetch('/api/campaigns/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate_ai', ...payload }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to generate template');
            const data = await res.json();
            return data as { template: EmailTemplate; subject_variants: string[] };
        },
        onSuccess: ({ template }) => {
            qc.setQueryData<EmailTemplate[]>(templateKeys.list(), (prev) =>
                prev ? [template, ...prev] : [template]
            );
        },
    });
}
