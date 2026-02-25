'use client';

import React, { useState, useMemo } from 'react';
import { useConversations, useConversationMessages, useSendMessage, useTransferConversation, useCloseConversation } from '@/hooks/useConversations';
import { useAgentConfig } from '@/hooks/useAgentConfig';
import { useConversationRealtime, useConversationsListRealtime } from '@/hooks/useConversationRealtime';
import { ConversationsList } from './components/ConversationsList';
import { ConversationChat } from './components/ConversationChat';
import { ConversationContext } from './components/ConversationContext';

export const ConversationsPage: React.FC = () => {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Data hooks
    const { data: conversations, isLoading: convLoading } = useConversations({
        status: statusFilter === 'all' ? undefined : statusFilter,
    });

    const { data: messages, isLoading: msgLoading } = useConversationMessages(selectedId ?? '');
    const { data: agentConfig } = useAgentConfig();
    const sendNote = useSendMessage();
    const transferConversation = useTransferConversation();
    const closeConversation = useCloseConversation();

    // Realtime subscriptions
    useConversationsListRealtime();
    useConversationRealtime(selectedId ?? '');

    // Filter conversations by search query
    const filteredConversations = useMemo(() => {
        if (!conversations) return [];
        if (!searchQuery.trim()) return conversations;
        const q = searchQuery.toLowerCase();
        return conversations.filter(
            (c: any) =>
                (c.whatsapp_name ?? '').toLowerCase().includes(q) ||
                c.whatsapp_number.includes(q)
        );
    }, [conversations, searchQuery]);

    // Selected conversation details
    const selectedConversation = useMemo(
        () => filteredConversations.find((c: any) => c.id === selectedId),
        [filteredConversations, selectedId]
    );

    // Handlers
    const handleSendNote = (note: string) => {
        if (!selectedId) return;
        sendNote.mutate({
            conversationId: selectedId,
            content: note,
            role: 'system',
            isInternalNote: true,
        });
    };

    const handleTakeOver = () => {
        if (!selectedId) return;
        transferConversation.mutate({
            conversationId: selectedId,
            status: 'human_active',
        });
    };

    const handleReturnToAi = () => {
        if (!selectedId) return;
        transferConversation.mutate({
            conversationId: selectedId,
            status: 'active',
            assignedAgent: 'ai',
        });
    };

    const handleCloseConversation = () => {
        if (!selectedId) return;
        closeConversation.mutate({ conversationId: selectedId });
    };

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">
                        Conversas
                    </h1>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                        {agentConfig?.is_active ? '🟢 NossoAgent Ativo' : '🔴 Inativo'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                        {filteredConversations.length} conversa{filteredConversations.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {/* Three-panel layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Conversations List */}
                <div className="w-80 flex-shrink-0">
                    <ConversationsList
                        conversations={filteredConversations}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        statusFilter={statusFilter}
                        onStatusFilterChange={setStatusFilter}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        isLoading={convLoading}
                    />
                </div>

                {/* Center: Chat */}
                <div className="flex-1 min-w-0">
                    {selectedId && selectedConversation ? (
                        <ConversationChat
                            conversationId={selectedId}
                            messages={messages ?? []}
                            status={selectedConversation.status}
                            assignedAgent={selectedConversation.assigned_agent}
                            whatsappName={selectedConversation.whatsapp_name}
                            isLoading={msgLoading}
                            onSendNote={handleSendNote}
                            onTakeOver={handleTakeOver}
                            onReturnToAi={handleReturnToAi}
                            onCloseConversation={handleCloseConversation}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <span className="text-6xl mb-4">🤖</span>
                            <h2 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                NossoAgent
                            </h2>
                            <p className="text-sm">Selecione uma conversa para visualizar</p>
                        </div>
                    )}
                </div>

                {/* Right: Context Panel */}
                {selectedId && selectedConversation && (
                    <div className="w-72 flex-shrink-0 hidden xl:block">
                        <ConversationContext
                            contact={selectedConversation.contact ?? null}
                            deal={selectedConversation.deal ?? null}
                            qualificationStatus={selectedConversation.qualification_status}
                            qualificationScore={selectedConversation.qualification_score}
                            qualificationData={selectedConversation.qualification_data ?? {}}
                            qualificationFields={agentConfig?.qualification_fields ?? []}
                            toolsLog={selectedConversation.tools_log ?? []}
                            detectedIntent={selectedConversation.detected_intent}
                            detectedSentiment={selectedConversation.detected_sentiment}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
