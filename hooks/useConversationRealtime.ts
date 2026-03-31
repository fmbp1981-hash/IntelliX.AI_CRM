// hooks/useConversationRealtime.ts — Supabase Realtime for live chat

'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Message, Conversation } from '@/types/agent';

export function useConversationRealtime(conversationId: string | undefined) {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!conversationId) return;

        const supabase = createBrowserClient();

        const channel = supabase
            .channel(`conversation:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    const newMessage = payload.new as Message;
                    queryClient.setQueryData(
                        ['messages', conversationId],
                        (old: Message[] | undefined) => {
                            if (!old) return [newMessage];
                            const exists = old.some((m) => m.id === newMessage.id);
                            return exists ? old : [...old, newMessage];
                        }
                    );
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'conversations',
                    filter: `id=eq.${conversationId}`,
                },
                (payload) => {
                    const updated = payload.new as Conversation;
                    queryClient.setQueryData(
                        ['conversations', 'detail', conversationId],
                        updated
                    );
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    const updatedMsg = payload.new as Message;
                    queryClient.setQueryData(
                        ['messages', conversationId],
                        (old: Message[] | undefined) =>
                            old?.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)) ?? []
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversationId, queryClient]);
}

export function useConversationsListRealtime(organizationId: string | undefined) {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!organizationId) return;

        const supabase = createBrowserClient();

        const channel = supabase
            .channel(`org-conversations:${organizationId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'conversations',
                    filter: `organization_id=eq.${organizationId}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['conversations'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [organizationId, queryClient]);
}
