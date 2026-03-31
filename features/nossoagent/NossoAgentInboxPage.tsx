'use client';

/**
 * @fileoverview NossoAgent Inbox Page
 *
 * Painel de atendimento omnichannel estilo Chatwoot para o NossoAgent.
 * 3-panel layout: lista de conversas | janela de chat | contexto CRM
 *
 * Integra dados reais via Supabase Realtime + TanStack Query.
 * Suporta handover IA ↔ Humano com envio de mensagens pelo atendente.
 *
 * @module features/nossoagent/NossoAgentInboxPage
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    Search,
    Bot,
    UserSquare2,
    Clock,
    CheckCircle2,
    Archive,
    Settings,
    SendHorizonal,
    StickyNote,
    Phone,
    MoreVertical,
    ChevronLeft,
    MessageSquare,
    Loader2,
    RefreshCw,
    AlertCircle,
    X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
    useConversations,
    useMessages,
    useSendMessage,
    useUpdateConversation,
} from '@/hooks/useConversations';
import { useAgentConfig } from '@/hooks/useAgentConfig';
import {
    useConversationRealtime,
    useConversationsListRealtime,
} from '@/hooks/useConversationRealtime';
import { MessageBubble } from '@/features/conversations/components/MessageBubble';
import { ConversationContext } from '@/features/conversations/components/ConversationContext';
import { HandoverControls } from '@/features/agent-chat/components/HandoverControls';
import type { Conversation, ConversationStatus, Message } from '@/types/agent';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'active' | 'waiting_human' | 'human_active' | 'closed';

interface FilterConfig {
    key: FilterTab;
    label: string;
    icon: React.ElementType;
    status?: ConversationStatus;
    color: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_TABS: FilterConfig[] = [
    { key: 'all', label: 'Todas', icon: MessageSquare, color: 'text-slate-500' },
    { key: 'active', label: 'IA Ativa', icon: Bot, status: 'active', color: 'text-emerald-500' },
    { key: 'waiting_human', label: 'Aguardando', icon: Clock, status: 'waiting_human', color: 'text-amber-500' },
    { key: 'human_active', label: 'Humano', icon: UserSquare2, status: 'human_active', color: 'text-blue-500' },
    { key: 'closed', label: 'Encerradas', icon: CheckCircle2, status: 'closed', color: 'text-slate-400' },
];

const STATUS_BADGE: Record<string, { dot: string; label: string }> = {
    active: { dot: 'bg-emerald-500', label: 'IA Ativa' },
    waiting_human: { dot: 'bg-amber-500 animate-pulse', label: 'Aguardando' },
    human_active: { dot: 'bg-blue-500', label: 'Atendente' },
    closed: { dot: 'bg-slate-400', label: 'Encerrada' },
    archived: { dot: 'bg-slate-300', label: 'Arquivada' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return '';
    try {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'agora';
        if (mins < 60) return `${mins}min`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h`;
        return `${Math.floor(hours / 24)}d`;
    } catch { return ''; }
}

function getInitials(name: string | null, fallback: string): string {
    const str = name ?? fallback;
    return str.slice(0, 2).toUpperCase();
}

function getAvatarColor(id: string): string {
    const colors = [
        'from-emerald-400 to-teal-500',
        'from-blue-400 to-indigo-500',
        'from-violet-400 to-purple-500',
        'from-rose-400 to-pink-500',
        'from-amber-400 to-orange-500',
    ];
    const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
}

// ─── Subcomponent: ConversationItem ──────────────────────────────────────────

interface ConversationItemProps {
    conversation: Conversation;
    isSelected: boolean;
    lastMessage: string | undefined;
    onClick: () => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
    conversation,
    isSelected,
    lastMessage,
    onClick,
}) => {
    const badge = STATUS_BADGE[conversation.status] ?? STATUS_BADGE.active;
    const avatar = getAvatarColor(conversation.id);
    const initials = getInitials(conversation.whatsapp_name, conversation.whatsapp_number.slice(-4));

    return (
        <button
            onClick={onClick}
            className={`w-full text-left px-3 py-3 border-b border-slate-100 dark:border-white/5 transition-all duration-150 hover:bg-slate-50 dark:hover:bg-white/5 group relative ${isSelected
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-l-2 border-l-emerald-500'
                : 'border-l-2 border-l-transparent'
                }`}
        >
            <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatar} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {initials}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                            {conversation.whatsapp_name ?? conversation.whatsapp_number}
                        </span>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                            {formatRelativeTime(conversation.last_message_at)}
                        </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {lastMessage ?? 'Sem mensagens ainda'}
                    </p>

                    {/* Status badge */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${badge.dot}`} />
                        <span className="text-[10px] text-slate-400">{badge.label}</span>
                        {conversation.qualification_status === 'qualified' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ml-auto">
                                ✓ Qualificado
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </button>
    );
};

// ─── Subcomponent: ChatInput ──────────────────────────────────────────────────

interface ChatInputProps {
    conversationId: string;
    organizationId: string;
    status: ConversationStatus;
    disabled?: boolean;
    onSend: (content: string, isNote: boolean) => void;
    isSending?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
    status,
    disabled,
    onSend,
    isSending,
}) => {
    const [text, setText] = useState('');
    const [isNote, setIsNote] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const isHumanActive = status === 'human_active';
    const isClosed = status === 'closed' || status === 'archived';

    const handleSend = useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed || isSending) return;
        onSend(trimmed, isNote);
        setText('');
        setIsNote(false);
    }, [text, isNote, isSending, onSend]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (isClosed) {
        return (
            <div className="px-4 py-3 border-t border-slate-200 dark:border-white/10 text-center text-xs text-slate-400">
                🔒 Conversa encerrada
            </div>
        );
    }

    if (!isHumanActive) {
        return (
            <div className="px-4 py-3 border-t border-slate-200 dark:border-white/10">
                <div className="rounded-xl bg-slate-100 dark:bg-white/5 px-4 py-3 flex items-center gap-3">
                    <Bot size={16} className="text-emerald-500 flex-shrink-0" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        O NossoAgent está em controle. Assuma a conversa para enviar mensagens.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="border-t border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card">
            {/* Note toggle */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                <button
                    onClick={() => setIsNote(false)}
                    className={`text-xs px-2.5 py-1 rounded-full transition-colors font-medium ${!isNote
                        ? 'bg-blue-500 text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    💬 Mensagem
                </button>
                <button
                    onClick={() => setIsNote(true)}
                    className={`text-xs px-2.5 py-1 rounded-full transition-colors font-medium ${isNote
                        ? 'bg-amber-500 text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    <StickyNote size={11} className="inline mr-1" />
                    Nota interna
                </button>
            </div>

            {/* Textarea */}
            <div className="px-4 pb-3">
                <div className={`flex items-end gap-2 rounded-xl border transition-colors ${isNote
                    ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/5'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5'
                    }`}>
                    <textarea
                        ref={textareaRef}
                        rows={2}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={disabled || isSending}
                        placeholder={isNote ? 'Nota interna (não enviada ao lead)...' : 'Digite uma mensagem (Enter para enviar)...'}
                        className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none min-h-[56px] max-h-[160px] disabled:opacity-50"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!text.trim() || isSending}
                        className="mb-2 mr-2 p-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors flex-shrink-0"
                    >
                        {isSending ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <SendHorizonal size={16} />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Subcomponent: EmptyState ─────────────────────────────────────────────────

const EmptyState: React.FC<{ filter: FilterTab }> = ({ filter }) => (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
            <MessageSquare size={28} className="text-slate-400" />
        </div>
        <div>
            <p className="font-semibold text-slate-700 dark:text-slate-300">Nenhuma conversa</p>
            <p className="text-sm text-slate-400 mt-1">
                {filter === 'waiting_human'
                    ? 'Nenhum lead aguardando atendimento humano.'
                    : filter === 'human_active'
                        ? 'Nenhum atendimento humano ativo no momento.'
                        : 'Nenhuma conversa encontrada para este filtro.'}
            </p>
        </div>
    </div>
);

// ─── Subcomponent: ChatEmptyState ─────────────────────────────────────────────

const ChatEmptyState: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center">
            <Bot size={28} className="text-emerald-500" />
        </div>
        <div>
            <p className="font-semibold text-slate-700 dark:text-slate-300">NossoAgent Inbox</p>
            <p className="text-sm text-slate-400 mt-1">
                Selecione uma conversa para visualizar o chat e tomar controle do atendimento.
            </p>
        </div>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const NossoAgentInboxPage: React.FC = () => {
    const { organizationId, profile } = useAuth();
    const { data: agentConfig } = useAgentConfig();

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showMobileChat, setShowMobileChat] = useState(false);

    // Hooks de dados
    const {
        data: conversations,
        isLoading: convLoading,
        isError: convError,
        refetch: refetchConversations,
    } = useConversations(
        activeFilter !== 'all'
            ? { status: activeFilter as ConversationStatus }
            : undefined
    );

    const { data: messages, isLoading: msgLoading } = useMessages(selectedId ?? undefined);
    const sendMessage = useSendMessage();
    const updateConversation = useUpdateConversation();

    // Realtime subscriptions
    useConversationsListRealtime(organizationId ?? undefined);
    useConversationRealtime(selectedId ?? undefined);

    // Scroll-to-bottom ref
    const messagesEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages?.length]);

    // Filtered conversations by search
    const filteredConversations = useMemo(() => {
        if (!conversations) return [];
        if (!searchQuery.trim()) return conversations;
        const q = searchQuery.toLowerCase();
        return conversations.filter(
            (c) =>
                (c.whatsapp_name ?? '').toLowerCase().includes(q) ||
                c.whatsapp_number.includes(q)
        );
    }, [conversations, searchQuery]);

    // Counts per filter tab
    const counts = useMemo(() => {
        if (!conversations) return {} as Record<FilterTab, number>;
        return {
            all: conversations.length,
            active: conversations.filter((c) => c.status === 'active').length,
            waiting_human: conversations.filter((c) => c.status === 'waiting_human').length,
            human_active: conversations.filter((c) => c.status === 'human_active').length,
            closed: conversations.filter((c) => c.status === 'closed').length,
        } as Record<FilterTab, number>;
    }, [conversations]);

    // Selected conversation
    const selectedConversation = useMemo(
        () => (conversations ?? []).find((c) => c.id === selectedId) ?? null,
        [conversations, selectedId]
    );

    // Last message per conversation (for preview)
    // We approximate this from conversation data — no need to fetch all messages for list
    const lastMessagePreviews = useMemo(() => {
        const map: Record<string, string | undefined> = {};
        (conversations ?? []).forEach((c) => {
            map[c.id] = c.summary ? c.summary.slice(0, 60) : undefined;
        });
        return map;
    }, [conversations]);

    // Message for actual selected conversation
    const lastMessagePreview = useMemo(() => {
        if (!messages || messages.length === 0) return undefined;
        const last = [...messages].reverse().find((m) => !m.is_internal_note);
        return last?.content.slice(0, 60);
    }, [messages]);

    // Handlers
    const handleSelectConversation = useCallback((id: string) => {
        setSelectedId(id);
        setShowMobileChat(true);
    }, []);

    const handleSendMessage = useCallback(
        (content: string, isNote: boolean) => {
            if (!selectedId || !organizationId) return;
            sendMessage.mutate({
                conversation_id: selectedId,
                organization_id: organizationId,
                role: isNote ? 'system' : 'human',
                content,
                content_type: 'text',
                is_internal_note: isNote,
                sender_id: profile?.id ?? null,
                sender_name: profile?.first_name ?? 'Atendente',
            } as any);
        },
        [selectedId, organizationId, profile, sendMessage]
    );

    const handleTakeOver = useCallback(() => {
        if (!selectedId) return;
        updateConversation.mutate({
            id: selectedId,
            updates: {
                status: 'human_active',
                assigned_agent: profile?.id ?? 'human',
                transferred_at: new Date().toISOString(),
            },
        });
    }, [selectedId, profile, updateConversation]);

    const handleReturnToBot = useCallback(() => {
        if (!selectedId) return;
        updateConversation.mutate({
            id: selectedId,
            updates: { status: 'active', assigned_agent: 'ai' },
        });
    }, [selectedId, updateConversation]);

    const handleTogglePause = useCallback(() => {
        if (!selectedConversation) return;
        const next: ConversationStatus =
            selectedConversation.status === 'active' ? 'waiting_human' : 'active';
        updateConversation.mutate({
            id: selectedConversation.id,
            updates: { status: next },
        });
    }, [selectedConversation, updateConversation]);

    const handleClose = useCallback(() => {
        if (!selectedId) return;
        updateConversation.mutate({
            id: selectedId,
            updates: { status: 'closed', closed_at: new Date().toISOString() },
        });
    }, [selectedId, updateConversation]);

    // Agent status for HandoverControls
    const agentStatus = useMemo((): 'bot_active' | 'human_active' | 'paused' => {
        if (!selectedConversation) return 'bot_active';
        if (selectedConversation.status === 'human_active') return 'human_active';
        if (selectedConversation.status === 'waiting_human') return 'paused';
        return 'bot_active';
    }, [selectedConversation]);

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-white dark:bg-dark-bg">

            {/* ── Panel 1: Conversation Sidebar ─────────────────────────────── */}
            <div className={`flex flex-col w-full sm:w-80 lg:w-72 xl:w-80 flex-shrink-0 border-r border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card ${showMobileChat ? 'hidden sm:flex' : 'flex'}`}>

                {/* Header */}
                <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-white/10">
                    <div className="flex items-center justify-between mb-3">
                        <h1 className="text-base font-bold text-slate-900 dark:text-white">
                            NossoAgent
                        </h1>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => refetchConversations()}
                                title="Atualizar"
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <RefreshCw size={14} />
                            </button>
                            <button
                                onClick={() => window.location.href = '/settings?tab=ai'}
                                title="Configurar agente"
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <Settings size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar conversas..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm bg-slate-100 dark:bg-white/5 rounded-lg border-0 outline-none placeholder:text-slate-400 text-slate-900 dark:text-slate-100"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 dark:border-white/5 overflow-x-auto scrollbar-none">
                    {FILTER_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const count = counts[tab.key] ?? 0;
                        const isActive = activeFilter === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveFilter(tab.key)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${isActive
                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                                    }`}
                            >
                                <Icon size={11} className={isActive ? '' : tab.color} />
                                {tab.label}
                                {count > 0 && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-slate-200 dark:bg-white/10'}`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Conversations List */}
                <div className="flex-1 overflow-y-auto">
                    {convLoading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 size={20} className="animate-spin text-slate-400" />
                        </div>
                    )}
                    {convError && (
                        <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                            <AlertCircle size={20} className="text-rose-400" />
                            <p className="text-xs text-slate-400">Erro ao carregar conversas</p>
                            <button onClick={() => refetchConversations()} className="text-xs text-blue-500 hover:underline">
                                Tentar novamente
                            </button>
                        </div>
                    )}
                    {!convLoading && !convError && filteredConversations.length === 0 && (
                        <EmptyState filter={activeFilter} />
                    )}
                    {filteredConversations.map((conv) => (
                        <ConversationItem
                            key={conv.id}
                            conversation={conv}
                            isSelected={conv.id === selectedId}
                            lastMessage={lastMessagePreviews[conv.id]}
                            onClick={() => handleSelectConversation(conv.id)}
                        />
                    ))}
                </div>

                {/* Agent status footer */}
                {agentConfig && (
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-white/10 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${agentConfig.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {agentConfig.is_active ? `${agentConfig.agent_name} ativo` : 'Agente inativo'}
                        </span>
                    </div>
                )}
            </div>

            {/* ── Panel 2: Chat Window ──────────────────────────────────────── */}
            <div className={`flex flex-col flex-1 min-w-0 ${!showMobileChat && 'hidden sm:flex'}`}>
                {!selectedConversation ? (
                    <ChatEmptyState />
                ) : (
                    <>
                        {/* Chat Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card flex-shrink-0">
                            <div className="flex items-center gap-3">
                                {/* Mobile back button */}
                                <button
                                    onClick={() => setShowMobileChat(false)}
                                    className="sm:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500"
                                >
                                    <ChevronLeft size={18} />
                                </button>

                                {/* Avatar */}
                                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(selectedConversation.id)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                                    {getInitials(selectedConversation.whatsapp_name, selectedConversation.whatsapp_number.slice(-4))}
                                </div>

                                {/* Name + status */}
                                <div>
                                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                                        {selectedConversation.whatsapp_name ?? selectedConversation.whatsapp_number}
                                    </h2>
                                    <div className="flex items-center gap-1.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_BADGE[selectedConversation.status]?.dot ?? 'bg-slate-400'}`} />
                                        <span className="text-[10px] text-slate-400">
                                            {STATUS_BADGE[selectedConversation.status]?.label}
                                            {' · '}
                                            {selectedConversation.whatsapp_number}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Header actions */}
                            <div className="flex items-center gap-1">
                                <button
                                    title="Ligar"
                                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 transition-colors"
                                >
                                    <Phone size={15} />
                                </button>
                                <button
                                    title="Encerrar conversa"
                                    onClick={handleClose}
                                    disabled={selectedConversation.status === 'closed'}
                                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-40"
                                >
                                    <Archive size={15} />
                                </button>
                                <button
                                    title="Mais opções"
                                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 transition-colors"
                                >
                                    <MoreVertical size={15} />
                                </button>
                            </div>
                        </div>

                        {/* Handover Controls */}
                        <HandoverControls
                            status={agentStatus}
                            onTakeover={handleTakeOver}
                            onReturnToBot={handleReturnToBot}
                            onTogglePause={handleTogglePause}
                        />

                        {/* Messages area */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-slate-50/50 dark:bg-dark-bg/30">
                            {msgLoading && (
                                <div className="flex justify-center py-8">
                                    <Loader2 size={18} className="animate-spin text-slate-400" />
                                </div>
                            )}
                            {!msgLoading && (!messages || messages.length === 0) && (
                                <div className="text-center py-8 text-sm text-slate-400">
                                    Nenhuma mensagem ainda
                                </div>
                            )}
                            {(messages ?? []).map((msg: Message) => (
                                <MessageBubble
                                    key={msg.id}
                                    role={msg.role}
                                    content={msg.content}
                                    timestamp={msg.created_at}
                                    senderName={msg.sender_name ?? undefined}
                                    isInternalNote={msg.is_internal_note}
                                    aiToolsUsed={msg.ai_tools_used}
                                />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Chat Input */}
                        <ChatInput
                            conversationId={selectedConversation.id}
                            organizationId={organizationId!}
                            status={selectedConversation.status}
                            onSend={handleSendMessage}
                            isSending={sendMessage.isPending}
                        />
                    </>
                )}
            </div>

            {/* ── Panel 3: Contact Context Panel ───────────────────────────── */}
            {selectedConversation && (
                <div className="hidden xl:flex flex-col w-72 flex-shrink-0 overflow-y-auto border-l border-slate-200 dark:border-white/10">
                    <div className="px-4 pt-4 pb-2 border-b border-slate-100 dark:border-white/10">
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Contexto CRM
                        </h3>
                    </div>
                    <ConversationContext
                        contact={null}
                        deal={null}
                        qualificationStatus={selectedConversation.qualification_status}
                        qualificationScore={selectedConversation.qualification_score}
                        qualificationData={selectedConversation.qualification_data}
                        qualificationFields={agentConfig?.qualification_fields ?? []}
                        toolsLog={[]}
                        detectedIntent={selectedConversation.detected_intent}
                        detectedSentiment={selectedConversation.sentiment}
                    />

                    {/* Summary */}
                    {selectedConversation.summary && (
                        <div className="px-4 py-3 border-t border-slate-100 dark:border-white/10">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Resumo da IA</h4>
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                {selectedConversation.summary}
                            </p>
                        </div>
                    )}

                    {/* Quick actions */}
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-white/10 space-y-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Ações Rápidas</h4>
                        {selectedConversation.contact_id ? (
                            <a
                                href={`/contacts/${selectedConversation.contact_id}`}
                                className="block text-xs text-blue-500 hover:text-blue-600 hover:underline"
                            >
                                → Ver contato no CRM
                            </a>
                        ) : (
                            <p className="text-xs text-slate-400 italic">Contato não vinculado</p>
                        )}
                        {selectedConversation.deal_id && (
                            <a
                                href={`/deals/${selectedConversation.deal_id}`}
                                className="block text-xs text-blue-500 hover:text-blue-600 hover:underline"
                            >
                                → Ver deal no pipeline
                            </a>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
