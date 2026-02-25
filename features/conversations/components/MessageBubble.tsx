'use client';

import React from 'react';

interface MessageBubbleProps {
    role: 'lead' | 'ai' | 'human' | 'system';
    content: string;
    timestamp: string;
    senderName?: string;
    isInternalNote?: boolean;
    aiToolsUsed?: string[];
}

const ROLE_STYLES: Record<string, { bg: string; align: string; label: string }> = {
    lead: {
        bg: 'bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-slate-100',
        align: 'justify-start',
        label: 'Lead',
    },
    ai: {
        bg: 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-slate-900 dark:text-slate-100',
        align: 'justify-end',
        label: '🤖 NossoAgent',
    },
    human: {
        bg: 'bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 text-slate-900 dark:text-slate-100',
        align: 'justify-end',
        label: '👤 Atendente',
    },
    system: {
        bg: 'bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300',
        align: 'justify-center',
        label: '⚙️ Sistema',
    },
};

function formatTime(ts: string): string {
    try {
        return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
    role,
    content,
    timestamp,
    senderName,
    isInternalNote,
    aiToolsUsed,
}) => {
    const style = ROLE_STYLES[role] ?? ROLE_STYLES.system;

    if (isInternalNote) {
        return (
            <div className="flex justify-center my-2">
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-2 max-w-md text-center">
                    <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">📝 Nota interna</span>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">{content}</p>
                </div>
            </div>
        );
    }

    if (role === 'system') {
        return (
            <div className="flex justify-center my-2">
                <div className={`${style.bg} rounded-lg px-4 py-2 max-w-md text-center`}>
                    <p className="text-xs">{content}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex ${style.align} my-1`}>
            <div className={`${style.bg} rounded-2xl px-4 py-2.5 max-w-[75%] min-w-[80px]`}>
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold opacity-60">
                        {senderName ?? style.label}
                    </span>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
                <div className="flex items-center justify-end gap-2 mt-1">
                    {aiToolsUsed && aiToolsUsed.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                            {aiToolsUsed.map((tool) => (
                                <span
                                    key={tool}
                                    className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono"
                                >
                                    {tool}
                                </span>
                            ))}
                        </div>
                    )}
                    <span className="text-[10px] opacity-40">{formatTime(timestamp)}</span>
                </div>
            </div>
        </div>
    );
};
