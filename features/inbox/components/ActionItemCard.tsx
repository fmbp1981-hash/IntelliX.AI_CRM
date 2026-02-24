/**
 * Action Item Card Component
 * 
 * Card individual de uma ação do Inbox Inteligente 2.0.
 * Exibe: título, razão, deal associado, tipo de ação, prioridade.
 * Quick actions: Completar, Adiar, Ignorar.
 */
import React, { useState } from 'react';
import {
    Phone,
    Mail,
    MessageSquare,
    Calendar,
    CheckSquare,
    ArrowRight,
    Check,
    Clock,
    X,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import type { ActionItem, ActionItemType, ActionPriority } from '@/lib/supabase/inbox-actions';

const ACTION_TYPE_CONFIG: Record<ActionItemType, { icon: typeof Phone; label: string; color: string }> = {
    CALL: { icon: Phone, label: 'Ligar', color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
    EMAIL: { icon: Mail, label: 'Email', color: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10' },
    WHATSAPP: { icon: MessageSquare, label: 'WhatsApp', color: 'text-green-500 bg-green-50 dark:bg-green-500/10' },
    MEETING: { icon: Calendar, label: 'Reunião', color: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10' },
    TASK: { icon: CheckSquare, label: 'Tarefa', color: 'text-slate-500 bg-slate-50 dark:bg-slate-500/10' },
    MOVE_STAGE: { icon: ArrowRight, label: 'Mover', color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' },
};

const PRIORITY_CONFIG: Record<ActionPriority, { label: string; bg: string; text: string; border: string }> = {
    critical: {
        label: 'Crítico',
        bg: 'bg-red-50 dark:bg-red-500/10',
        text: 'text-red-600 dark:text-red-400',
        border: 'border-l-red-500',
    },
    high: {
        label: 'Alta',
        bg: 'bg-orange-50 dark:bg-orange-500/10',
        text: 'text-orange-600 dark:text-orange-400',
        border: 'border-l-orange-500',
    },
    medium: {
        label: 'Média',
        bg: 'bg-yellow-50 dark:bg-yellow-500/10',
        text: 'text-yellow-600 dark:text-yellow-400',
        border: 'border-l-yellow-500',
    },
    low: {
        label: 'Baixa',
        bg: 'bg-green-50 dark:bg-green-500/10',
        text: 'text-green-600 dark:text-green-400',
        border: 'border-l-green-500',
    },
};

interface ActionItemCardProps {
    item: ActionItem;
    onComplete: (id: string) => void;
    onDismiss: (id: string) => void;
    onSnooze: (id: string, until: Date) => void;
    loading?: boolean;
}

export const ActionItemCard: React.FC<ActionItemCardProps> = ({
    item,
    onComplete,
    onDismiss,
    onSnooze,
    loading,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);

    const actionConfig = ACTION_TYPE_CONFIG[item.action_type] || ACTION_TYPE_CONFIG.TASK;
    const priorityConfig = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.medium;
    const ActionIcon = actionConfig.icon;

    const snoozeOptions = [
        { label: 'Amanhã', hours: 24 },
        { label: '2 dias', hours: 48 },
        { label: 'Próxima semana', hours: 168 },
    ];

    return (
        <div
            className={`bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden border-l-4 ${priorityConfig.border} transition-all hover:shadow-md`}
        >
            <div className="p-4">
                {/* Top row: Type icon + Title + Priority badge */}
                <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${actionConfig.color}`}>
                        <ActionIcon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                {item.title}
                            </h4>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${priorityConfig.bg} ${priorityConfig.text} font-medium flex-shrink-0`}>
                                {priorityConfig.label}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                            {item.reason}
                        </p>
                    </div>

                    {/* Expand/Collapse */}
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex-shrink-0"
                    >
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>

                {/* Expanded details */}
                {expanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 space-y-2">
                        {item.deal && (
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <span className="text-slate-400">Deal:</span>
                                <span className="font-medium">{item.deal.title}</span>
                                {item.deal.value > 0 && (
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                        R$ {item.deal.value.toLocaleString('pt-BR')}
                                    </span>
                                )}
                            </div>
                        )}
                        {item.contact && (
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <span className="text-slate-400">Contato:</span>
                                <span className="font-medium">{item.contact.name}</span>
                                {item.contact.phone && (
                                    <span className="text-slate-400">{item.contact.phone}</span>
                                )}
                            </div>
                        )}
                        {item.suggested_script && (
                            <div className="mt-2 p-3 bg-slate-50 dark:bg-black/20 rounded-lg">
                                <p className="text-xs text-slate-400 mb-1 font-medium">Script sugerido:</p>
                                <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                                    &ldquo;{item.suggested_script}&rdquo;
                                </p>
                            </div>
                        )}
                        <p className="text-xs text-slate-400">
                            Score: {item.priority_score} • Criado: {new Date(item.created_at).toLocaleDateString('pt-BR')}
                        </p>
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-3">
                    <button
                        onClick={() => onComplete(item.id)}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                        <Check className="w-3.5 h-3.5" />
                        Feito
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setShowSnoozeOptions(!showSnoozeOptions)}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                            <Clock className="w-3.5 h-3.5" />
                            Adiar
                        </button>
                        {showSnoozeOptions && (
                            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
                                {snoozeOptions.map(opt => (
                                    <button
                                        key={opt.hours}
                                        onClick={() => {
                                            onSnooze(item.id, new Date(Date.now() + opt.hours * 60 * 60 * 1000));
                                            setShowSnoozeOptions(false);
                                        }}
                                        className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => onDismiss(item.id)}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                        <X className="w-3.5 h-3.5" />
                        Ignorar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActionItemCard;
