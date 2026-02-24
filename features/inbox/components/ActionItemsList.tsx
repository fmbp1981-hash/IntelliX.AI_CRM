/**
 * Action Items List Component
 * 
 * Lista de ações priorizadas do Inbox Inteligente 2.0.
 * Header com filtros + botão de gerar + lista de ActionItemCards.
 */
import React, { useState } from 'react';
import {
    Sparkles,
    Loader2,
    ListTodo,
    CheckCircle,
    Clock,
    XCircle,
    Filter,
} from 'lucide-react';
import { ActionItemCard } from './ActionItemCard';
import { StreakCounter } from './StreakCounter';
import {
    useActionItems,
    useCompleteAction,
    useDismissAction,
    useSnoozeAction,
    useGenerateActions,
} from '../hooks/useActionItems';
import type { ActionItemStatus } from '@/lib/supabase/inbox-actions';

const STATUS_TABS: { key: ActionItemStatus; label: string; icon: typeof ListTodo }[] = [
    { key: 'pending', label: 'Pendentes', icon: ListTodo },
    { key: 'completed', label: 'Concluídas', icon: CheckCircle },
    { key: 'snoozed', label: 'Adiadas', icon: Clock },
    { key: 'dismissed', label: 'Ignoradas', icon: XCircle },
];

export const ActionItemsList: React.FC = () => {
    const [status, setStatus] = useState<ActionItemStatus>('pending');
    const { data: items, isLoading } = useActionItems(status);
    const completeAction = useCompleteAction();
    const dismissAction = useDismissAction();
    const snoozeAction = useSnoozeAction();
    const generateActions = useGenerateActions();

    const anyMutating = completeAction.isPending || dismissAction.isPending || snoozeAction.isPending;

    return (
        <div className="space-y-5">
            {/* Header + Streak */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <ListTodo className="w-5 h-5 text-primary-500" />
                        Ações Inteligentes
                    </h2>
                    <StreakCounter />
                </div>

                <button
                    onClick={() => generateActions.mutate()}
                    disabled={generateActions.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
                >
                    {generateActions.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Sparkles className="w-4 h-4" />
                    )}
                    Gerar Ações
                </button>
            </div>

            {/* Generation feedback */}
            {generateActions.isSuccess && generateActions.data && (
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-700 dark:text-emerald-400">
                    ✨ {generateActions.data.generated} ações geradas com base nos seus deals e atividades.
                </div>
            )}

            {/* Status Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 rounded-lg p-1">
                {STATUS_TABS.map(tab => {
                    const TabIcon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setStatus(tab.key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${status === tab.key
                                    ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            <TabIcon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Items List */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-slate-400 animate-spin mb-3" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Carregando ações...</p>
                </div>
            ) : !items || items.length === 0 ? (
                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center">
                    {status === 'pending' ? (
                        <>
                            <Sparkles className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                Inbox Zerado! 🎉
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                Todas as ações foram concluídas. Clique em &ldquo;Gerar Ações&rdquo; para analisar seus deals.
                            </p>
                        </>
                    ) : (
                        <>
                            <Filter className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Nenhuma ação encontrada com status &ldquo;{STATUS_TABS.find(t => t.key === status)?.label}&rdquo;.
                            </p>
                        </>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map((item: any) => (
                        <ActionItemCard
                            key={item.id}
                            item={item}
                            onComplete={(id) => completeAction.mutate(id)}
                            onDismiss={(id) => dismissAction.mutate(id)}
                            onSnooze={(id, until) => snoozeAction.mutate({ itemId: id, snoozeUntil: until })}
                            loading={anyMutating}
                        />
                    ))}
                </div>
            )}

            {/* Count */}
            {items && items.length > 0 && (
                <p className="text-xs text-slate-400 text-center">
                    {items.length} ação(ões) • Ordenadas por prioridade
                </p>
            )}
        </div>
    );
};

export default ActionItemsList;
