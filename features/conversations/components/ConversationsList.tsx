'use client';

import React from 'react';

interface ConversationItemProps {
    id: string;
    whatsappName: string | null;
    whatsappNumber: string;
    status: string;
    assignedAgent: string;
    lastMessagePreview?: string;
    lastMessageAt: string;
    qualificationStatus: string;
    isSelected: boolean;
    onClick: (id: string) => void;
}

const STATUS_INDICATORS: Record<string, { color: string; label: string }> = {
    active: { color: 'bg-emerald-500', label: 'IA ativa' },
    waiting_human: { color: 'bg-amber-500', label: 'Aguardando' },
    human_active: { color: 'bg-blue-500', label: 'Humano' },
    closed: { color: 'bg-slate-400', label: 'Encerrada' },
    archived: { color: 'bg-slate-300', label: 'Arquivada' },
};

function formatRelativeTime(dateStr: string): string {
    try {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'agora';
        if (mins < 60) return `${mins}min`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        return `${days}d`;
    } catch {
        return '';
    }
}

const ConversationItem: React.FC<ConversationItemProps> = ({
    id,
    whatsappName,
    whatsappNumber,
    status,
    lastMessagePreview,
    lastMessageAt,
    qualificationStatus,
    isSelected,
    onClick,
}) => {
    const indicator = STATUS_INDICATORS[status] ?? STATUS_INDICATORS.active;

    return (
        <button
            onClick={() => onClick(id)}
            className={`w-full text-left px-4 py-3 border-b border-slate-100 dark:border-white/5 transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${isSelected ? 'bg-slate-100 dark:bg-white/10 border-l-2 border-l-emerald-500' : ''
                }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${indicator.color}`} />
                    <span className="font-medium text-sm text-slate-900 dark:text-white truncate">
                        {whatsappName ?? whatsappNumber}
                    </span>
                </div>
                <span className="text-[10px] text-slate-400 flex-shrink-0">
                    {formatRelativeTime(lastMessageAt)}
                </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate pl-4">
                {lastMessagePreview ?? 'Sem mensagens'}
            </p>

            <div className="flex items-center gap-2 mt-1.5 pl-4">
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                    {indicator.label}
                </span>
                {qualificationStatus === 'qualified' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        ✅ Qualificado
                    </span>
                )}
                {qualificationStatus === 'in_progress' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        🔄 Qualificando
                    </span>
                )}
            </div>
        </button>
    );
};

// ── Main list ──

interface ConversationsListProps {
    conversations: Array<{
        id: string;
        whatsapp_name: string | null;
        whatsapp_number: string;
        status: string;
        assigned_agent: string;
        last_message_at: string;
        qualification_status: string;
        summary?: string;
    }>;
    selectedId: string | null;
    onSelect: (id: string) => void;
    statusFilter: string;
    onStatusFilterChange: (status: string) => void;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    isLoading: boolean;
}

const FILTER_OPTIONS = [
    { value: 'all', label: 'Todas' },
    { value: 'active', label: 'IA Ativa' },
    { value: 'waiting_human', label: 'Aguardando' },
    { value: 'human_active', label: 'Humano' },
    { value: 'closed', label: 'Encerradas' },
];

export const ConversationsList: React.FC<ConversationsListProps> = ({
    conversations,
    selectedId,
    onSelect,
    statusFilter,
    onStatusFilterChange,
    searchQuery,
    onSearchChange,
    isLoading,
}) => {
    return (
        <div className="flex flex-col h-full border-r border-slate-200 dark:border-white/10">
            {/* Search */}
            <div className="p-3 border-b border-slate-200 dark:border-white/10">
                <input
                    type="text"
                    placeholder="Buscar conversas..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
            </div>

            {/* Filters */}
            <div className="flex gap-1 px-3 py-2 border-b border-slate-200 dark:border-white/10 overflow-x-auto">
                {FILTER_OPTIONS.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => onStatusFilterChange(opt.value)}
                        className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${statusFilter === opt.value
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                            }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                        <span className="text-2xl mb-2">💬</span>
                        <span className="text-sm">Nenhuma conversa</span>
                    </div>
                ) : (
                    conversations.map((conv) => (
                        <ConversationItem
                            key={conv.id}
                            id={conv.id}
                            whatsappName={conv.whatsapp_name}
                            whatsappNumber={conv.whatsapp_number}
                            status={conv.status}
                            assignedAgent={conv.assigned_agent}
                            lastMessagePreview={conv.summary}
                            lastMessageAt={conv.last_message_at}
                            qualificationStatus={conv.qualification_status}
                            isSelected={selectedId === conv.id}
                            onClick={onSelect}
                        />
                    ))
                )}
            </div>

            {/* Footer count */}
            <div className="px-3 py-2 border-t border-slate-200 dark:border-white/10 text-center">
                <span className="text-[11px] text-slate-400">
                    {conversations.length} conversa{conversations.length !== 1 ? 's' : ''}
                </span>
            </div>
        </div>
    );
};
