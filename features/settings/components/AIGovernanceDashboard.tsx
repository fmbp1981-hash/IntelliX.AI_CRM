/**
 * AI Governance Dashboard Component
 * 
 * Dashboard de monitoramento de uso de IA da organização.
 * Mostra: tokens consumidos, custo estimado, quota, breakdown por provider/modelo.
 */
import React, { useState } from 'react';
import {
    Brain,
    TrendingUp,
    DollarSign,
    Zap,
    AlertTriangle,
    RefreshCw,
    BarChart3,
    CheckCircle,
    XCircle,
} from 'lucide-react';
import { useAIUsageStats, useAIQuotaStatus } from '../hooks/useAIGovernance';

type Period = 'day' | 'week' | 'month';

const PERIOD_LABELS: Record<Period, string> = {
    day: 'Hoje',
    week: 'Últimos 7 dias',
    month: 'Este mês',
};

/**
 * Componente React `AIGovernanceDashboard`.
 * Dashboard completo de governança de IA com stats, quota e breakdown.
 */
export const AIGovernanceDashboard: React.FC = () => {
    const [period, setPeriod] = useState<Period>('month');
    const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useAIUsageStats(period);
    const { data: quota, isLoading: quotaLoading } = useAIQuotaStatus();

    const loading = statsLoading || quotaLoading;

    // Quota progress
    const quotaUsedPct = quota
        ? Math.min(100, Math.round((quota.tokens_used_this_month / Math.max(quota.monthly_limit_tokens, 1)) * 100))
        : 0;
    const quotaBarColor = quotaUsedPct >= 90 ? 'bg-red-500' : quotaUsedPct >= 70 ? 'bg-yellow-500' : 'bg-emerald-500';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Brain className="w-6 h-6 text-violet-500" />
                        Governança de IA
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Monitore o uso, custos e quotas de IA da sua organização
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Period Selector */}
                    <div className="flex bg-slate-100 dark:bg-white/5 rounded-lg p-1">
                        {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setPeriod(key)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${period === key
                                    ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => refetchStats()}
                        disabled={loading}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Total Requests */}
                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-100 dark:bg-violet-500/20 rounded-lg">
                            <Zap className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {loading ? '—' : (stats?.total_requests ?? 0).toLocaleString('pt-BR')}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Requisições</p>
                        </div>
                    </div>
                </div>

                {/* Total Tokens */}
                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                            <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {loading ? '—' : ((stats?.total_tokens ?? 0) / 1000).toFixed(1) + 'K'}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Tokens</p>
                        </div>
                    </div>
                </div>

                {/* Estimated Cost */}
                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg">
                            <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {loading ? '—' : `$${(stats?.total_cost_usd ?? 0).toFixed(4)}`}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Custo Estimado</p>
                        </div>
                    </div>
                </div>

                {/* Success Rate */}
                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-500/20 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {loading ? '—' : `${stats?.total_requests ? ((stats.success_count / stats.total_requests) * 100).toFixed(1) : 0}%`}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Taxa de Sucesso</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quota Bar */}
            {quota && quota.monthly_limit_tokens > 0 && (
                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            {quotaUsedPct >= 90 && <AlertTriangle className="w-4 h-4 text-red-500" />}
                            Quota Mensal
                        </h3>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                            {(quota.tokens_used_this_month / 1000).toFixed(1)}K / {(quota.monthly_limit_tokens / 1000).toFixed(0)}K tokens
                        </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-white/10 rounded-full h-3">
                        <div
                            className={`h-3 rounded-full transition-all duration-500 ${quotaBarColor}`}
                            style={{ width: `${quotaUsedPct}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
                        <span>{quotaUsedPct}% utilizado</span>
                        <span>Reset dia {quota.reset_day} de cada mês</span>
                    </div>
                </div>
            )}

            {/* Breakdown by Provider/Model */}
            {stats?.by_model && Object.keys(stats.by_model).length > 0 && (
                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-white/10">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Uso por Provider / Modelo
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-white/5">
                                    <th className="text-left px-4 py-3 text-slate-500 dark:text-slate-400 font-medium">Provider</th>
                                    <th className="text-left px-4 py-3 text-slate-500 dark:text-slate-400 font-medium">Modelo</th>
                                    <th className="text-right px-4 py-3 text-slate-500 dark:text-slate-400 font-medium">Requisições</th>
                                    <th className="text-right px-4 py-3 text-slate-500 dark:text-slate-400 font-medium">Tokens</th>
                                    <th className="text-right px-4 py-3 text-slate-500 dark:text-slate-400 font-medium">Custo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {Object.entries(stats.by_model).map(([model, data], idx) => {
                                    const provider = model.startsWith('gpt') || model.startsWith('dall-e') ? 'OpenAI' :
                                        model.startsWith('claude') ? 'Anthropic' :
                                            model.startsWith('gemini') ? 'Google' : 'Outro';
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                            <td className="px-4 py-3 text-slate-900 dark:text-white font-medium capitalize">
                                                {provider}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">
                                                {model}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                                                {data.count.toLocaleString('pt-BR')}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                                                {((data.tokens ?? 0) / 1000).toFixed(1)}K
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                                                ${(data.cost ?? 0).toFixed(4)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Breakdown by Action */}
            {stats?.by_action && Object.keys(stats.by_action).length > 0 && (
                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-white/10">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Uso por Ação de IA
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {Object.entries(stats.by_action).map(([action, data], idx) => (
                            <div key={idx} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {action}
                                </span>
                                <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
                                    <span>{data.count} req</span>
                                    <span>{((data.tokens ?? 0) / 1000).toFixed(1)}K tokens</span>
                                    <span>${(data.cost ?? 0).toFixed(4)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && (!stats || stats.total_requests === 0) && (
                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center">
                    <Brain className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-slate-400">
                        Nenhum uso de IA registrado {PERIOD_LABELS[period].toLowerCase()}.
                    </p>
                </div>
            )}
        </div>
    );
};

export default AIGovernanceDashboard;
