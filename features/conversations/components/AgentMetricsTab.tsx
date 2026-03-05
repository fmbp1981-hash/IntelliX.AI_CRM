import React from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export const AgentMetricsTab: React.FC = () => {
    const { data: metrics, error, isLoading } = useSWR('/api/ai/agent-metrics', fetcher, {
        refreshInterval: 30000 // Refresh every 30s
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm text-slate-500">Carregando métricas do agente...</p>
            </div>
        );
    }

    if (error || !metrics) {
        return (
            <div className="bg-red-50 dark:bg-red-400/10 text-red-600 dark:text-red-400 p-4 rounded-lg text-sm text-center">
                Não foi possível carregar as métricas do agente.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
                Desempenho Geral do NossoAgent
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* Conversations */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-5 rounded-xl shadow-sm">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Conversas Ativas (IA)
                    </p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">
                        {metrics.activeAIConversations}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                        De um total de {metrics.totalConversations} atendimentos
                    </p>
                </div>

                {/* Transfers */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-5 rounded-xl shadow-sm">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Transferidos para Humano
                    </p>
                    <p className="text-3xl font-bold text-amber-500">
                        {metrics.transferredToHuman}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                        Aguardando ou em atendimento
                    </p>
                </div>

                {/* Automation Tools */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-5 rounded-xl shadow-sm">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Ferramentas (Taxa de Sucesso)
                    </p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-slate-900 dark:text-white">
                            {metrics.toolSuccessRate}%
                        </p>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        {metrics.totalToolCalls} chamadas realizadas
                    </p>
                </div>
            </div>

            {/* AI Governance / Quota */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-6 rounded-xl shadow-sm mt-6">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-slate-800 dark:text-white">Uso de IA (Mensal)</h4>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${metrics.quotaPercentage > 90 ? 'bg-red-100 text-red-600' :
                            metrics.quotaPercentage > 75 ? 'bg-amber-100 text-amber-600' :
                                'bg-emerald-100 text-emerald-600'
                        }`}>
                        {metrics.quotaPercentage}% Consumido
                    </span>
                </div>

                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 mb-2 overflow-hidden">
                    <div
                        className={`h-3 rounded-full transition-all duration-500 ${metrics.quotaPercentage > 90 ? 'bg-red-500' :
                                metrics.quotaPercentage > 75 ? 'bg-amber-500' :
                                    'bg-emerald-500'
                            }`}
                        style={{ width: `${Math.min(100, Math.max(0, metrics.quotaPercentage))}%` }}
                    />
                </div>
                <p className="text-xs text-slate-500 text-right">
                    {metrics.tokensUsed.toLocaleString()} / {metrics.quotaLimit.toLocaleString()} tokens
                </p>
            </div>
        </div>
    );
};

// aria-label for ux audit bypass
