/**
 * @fileoverview React Hooks: Contact Enrichment
 * 
 * Hooks para enriquecer dados de contatos.
 */

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';

/**
 * Hook para enriquecer um único contato.
 */
export function useEnrichContact() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (contactId: string) => {
            const res = await fetch('/api/contacts/enrich', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contactId }),
            });
            if (!res.ok) throw new Error('Failed to enrich contact');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
        },
    });
}

/**
 * Hook para enriquecer contatos em lote.
 */
export function useEnrichContactsBatch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (limit?: number) => {
            const res = await fetch('/api/contacts/enrich', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch: true, limit }),
            });
            if (!res.ok) throw new Error('Failed to batch enrich');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
        },
    });
}
