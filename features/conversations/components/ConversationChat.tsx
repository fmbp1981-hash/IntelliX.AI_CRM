'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MessageBubble } from './MessageBubble';

interface Message {
    id: string;
    role: 'lead' | 'ai' | 'human' | 'system';
    content: string;
    created_at: string;
    is_internal_note?: boolean;
    ai_tools_used?: string[];
}

interface ConversationChatProps {
    conversationId: string;
    messages: Message[];
    status: string;
    assignedAgent: string;
    whatsappName: string | null;
    isLoading: boolean;
    onSendNote: (note: string) => void;
    onTakeOver: () => void;
    onReturnToAi: () => void;
    onCloseConversation: () => void;
}

export const ConversationChat: React.FC<ConversationChatProps> = ({
    messages,
    status,
    assignedAgent,
    whatsappName,
    isLoading,
    onSendNote,
    onTakeOver,
    onReturnToAi,
    onCloseConversation,
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [noteText, setNoteText] = useState('');

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    const handleSendNote = () => {
        if (!noteText.trim()) return;
        onSendNote(noteText.trim());
        setNoteText('');
    };

    const isHumanControlling = status === 'human_active';
    const isWaitingHuman = status === 'waiting_human';
    const isClosed = status === 'closed' || status === 'archived';

    return (
        <div className="flex flex-col h-full">
            {/* Chat header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold">
                        {(whatsappName ?? '?')[0].toUpperCase()}
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                            {whatsappName ?? 'Lead'}
                        </h3>
                        <span className="text-[10px] text-slate-400">
                            {isHumanControlling
                                ? '👤 Atendimento humano'
                                : isWaitingHuman
                                    ? '⏳ Aguardando humano'
                                    : isClosed
                                        ? '🔒 Conversa encerrada'
                                        : '🤖 NossoAgent ativo'}
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {status === 'active' && (
                        <button
                            onClick={onTakeOver}
                            className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors font-medium"
                        >
                            Assumir
                        </button>
                    )}
                    {isHumanControlling && (
                        <button
                            onClick={onReturnToAi}
                            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors font-medium"
                        >
                            Devolver p/ IA
                        </button>
                    )}
                    {isWaitingHuman && (
                        <button
                            onClick={onTakeOver}
                            className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors font-medium animate-pulse"
                        >
                            Assumir conversa
                        </button>
                    )}
                    {!isClosed && (
                        <button
                            onClick={onCloseConversation}
                            className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                        >
                            Encerrar
                        </button>
                    )}
                </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <span className="text-4xl mb-3">💬</span>
                        <span className="text-sm">Aguardando mensagens...</span>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <MessageBubble
                            key={msg.id}
                            role={msg.role}
                            content={msg.content}
                            timestamp={msg.created_at}
                            isInternalNote={msg.is_internal_note}
                            aiToolsUsed={msg.ai_tools_used}
                        />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input area (notes only — messages go through WhatsApp) */}
            {!isClosed && (
                <div className="px-4 py-3 border-t border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendNote()}
                            placeholder={
                                isHumanControlling
                                    ? 'Adicionar nota interna...'
                                    : 'Nota interna (não enviada ao lead)...'
                            }
                            className="flex-1 px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                        <button
                            onClick={handleSendNote}
                            disabled={!noteText.trim()}
                            className="px-4 py-2 text-sm rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            📝
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                        Notas internas são visíveis apenas para a equipe
                    </p>
                </div>
            )}
        </div>
    );
};
