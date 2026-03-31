// hooks/useConversations.ts — Conversations list and detail hooks

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import {
    listConversations,
    getConversation,
    updateConversation,
    listMessages,
    createMessage,
} from '@/lib/supabase/agent';
import type {
    Conversation,
    ConversationsFilter,
    Message,
    ConversationStatus,
} from '@/types/agent';

const CONVERSATIONS_KEY = ['conversations'] as const;
const MESSAGES_KEY = ['messages'] as const;

export function useConversations(filter?: ConversationsFilter) {
    const { organizationId } = useAuth();
    const supabase = createBrowserClient();

    return useQuery<Conversation[]>({
        queryKey: [...CONVERSATIONS_KEY, organizationId, filter],
        queryFn: () => listConversations(supabase, organizationId!, filter),
        enabled: !!organizationId,
        staleTime: 30 * 1000,
        refetchInterval: 30 * 1000,
    });
}

export function useConversation(conversationId: string | undefined) {
    const supabase = createBrowserClient();

    return useQuery<Conversation | null>({
        queryKey: [...CONVERSATIONS_KEY, 'detail', conversationId],
        queryFn: () => getConversation(supabase, conversationId!),
        enabled: !!conversationId,
        staleTime: 10 * 1000,
    });
}

export function useUpdateConversation() {
    const queryClient = useQueryClient();
    const supabase = createBrowserClient();

    return useMutation({
        mutationFn: ({
            id,
            updates,
        }: {
            id: string;
            updates: Partial<Conversation>;
        }) => updateConversation(supabase, id, updates),
        onSuccess: (updated) => {
            queryClient.setQueryData(
                [...CONVERSATIONS_KEY, 'detail', updated.id],
                updated
            );
            queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        },
    });
}

export function useMessages(conversationId: string | undefined) {
    const supabase = createBrowserClient();

    return useQuery<Message[]>({
        queryKey: [...MESSAGES_KEY, conversationId],
        queryFn: () =>
            listMessages(supabase, { conversation_id: conversationId! }),
        enabled: !!conversationId,
        staleTime: 0,
    });
}

export function useSendMessage() {
    const queryClient = useQueryClient();
    const supabase = createBrowserClient();

    return useMutation({
        mutationFn: (
            message: Pick<
                Message,
                'conversation_id' | 'organization_id' | 'role' | 'content' | 'content_type'
            > &
                Partial<Message>
        ) => createMessage(supabase, message),
        onSuccess: (newMsg) => {
            queryClient.setQueryData(
                [...MESSAGES_KEY, newMsg.conversation_id],
                (old: Message[] | undefined) => [...(old ?? []), newMsg]
            );
        },
    });
}

export function useTransferConversation() {
    const updateMutation = useUpdateConversation();

    return useMutation({
        mutationFn: ({
            conversationId,
            userId,
        }: {
            conversationId: string;
            userId: string;
        }) =>
            updateMutation.mutateAsync({
                id: conversationId,
                updates: {
                    status: 'human_active' as ConversationStatus,
                    assigned_agent: userId,
                    transferred_at: new Date().toISOString(),
                },
            }),
    });
}

export function useCloseConversation() {
    const updateMutation = useUpdateConversation();

    return useMutation({
        mutationFn: (conversationId: string) =>
            updateMutation.mutateAsync({
                id: conversationId,
                updates: {
                    status: 'closed' as ConversationStatus,
                    closed_at: new Date().toISOString(),
                },
            }),
    });
}
