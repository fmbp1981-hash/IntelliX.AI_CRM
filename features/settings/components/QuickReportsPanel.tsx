/**
 * Quick Reports Panel
 * 
 * UI para gerar relatórios on-demand do CRM.
 * Seleciona tipo + período, gera relatório com visualização inline.
 */
import React, { useState } from 'react';
import {
    BarChart3,
    TrendingUp,
    Users,
    Activity,
    Loader2,
    Calendar,
    Download,
    AlertCircle,
} from 'lucide-react';
import { useGenerateReport } from '../hooks/useQuickReports';
import type { ReportType, ReportResult } from '@/lib/supabase/quick-reports';

const REPORT_TYPES: { id: ReportType; label: string; icon: typeof BarChart3; description: string }[] = [
    { id: 'sales_summary', label: 'Resumo de Vendas', icon: TrendingUp, description: 'Win rate, valor médio, tendência mensal' },
    { id: 'pipeline_health', label: 'Saúde do Pipeline', icon: BarChart3, description: 'Deals por estágio, gargalos, estagnação' },
    { id: 'team_performance', label: 'Performance da Equipe', icon: Users, description: 'Ranking de vendedores, atividades, conversão' },
    { id: 'activity_report', label: 'Relatório de Atividades', icon: Activity, description: 'Atividades por tipo, taxa de conclusão' },
];

function getDateRange(period: string): { start_date: string; end_date: string } {
    const end = new Date();
    const start = new Date();

    switch (period) {
        case '7d':
            start.setDate(end.getDate() - 7);
            break;
        case '30d':
            start.setDate(end.getDate() - 30);
            break;
        case '90d':
            start.setDate(end.getDate() - 90);
            break;
        case '12m':
            start.setMonth(end.getMonth() - 12);
            break;
        default:
            start.setDate(end.getDate() - 30);
    }

    return {
        start_date: start.toISOString(),
        end_date: end.toISOString(),
    };
}

export const QuickReportsPanel: React.FC = () => {
    const [selectedType, setSelectedType] = useState<ReportType>('sales_summary');
    const [period, setPeriod] = useState('30d');
    const report = useGenerateReport();

    const handleGenerate = () => {
        const filters = getDateRange(period);
        report.mutate({ type: selectedType, filters });
    };

    const renderReport = (result: ReportResult) => {
        switch (result.type) {
            case 'sales_summary': {
                const d = result.data;
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <StatCard label="Deals Ganhos" value={d.total_won} accent="text-green-500" />
                            <StatCard label="Valor Total Ganho" value={`R$ ${d.won_value.toLocaleString('pt-BR')}`} accent="text-green-500" />
                            <StatCard label="Win Rate" value={`${d.win_rate}%`} accent="text-blue-500" />
                            <StatCard label="Ticket Médio" value={`R$ ${d.avg_deal_value.toLocaleString('pt-BR')}`} accent="text-indigo-500" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <StatCard label="Deals Perdidos" value={d.total_lost} accent="text-red-500" />
                            <StatCard label="Deals Abertos" value={d.total_open} accent="text-amber-500" />
                            <StatCard label="Ciclo Médio" value={`${d.avg_close_days} dias`} accent="text-slate-500" />
                        </div>
                        {d.deals_by_month.length > 0 && (
                            <div className="bg-slate-50 dark:bg-black/20 rounded-lg p-3">
                                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Por Mês</h4>
                                <div className="space-y-1">
                                    {d.deals_by_month.map(m => (
                                        <div key={m.month} className="flex items-center justify-between text-xs">
                                            <span className="text-slate-600 dark:text-slate-300">{m.month}</span>
                                            <div className="flex gap-4">
                                                <span className="text-green-500">{m.won} ganhos</span>
                                                <span className="text-red-400">{m.lost} perdidos</span>
                                                <span className="text-slate-500">R$ {m.value.toLocaleString('pt-BR')}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            }

            case 'pipeline_health': {
                const d = result.data;
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <StatCard label="Valor Total Pipeline" value={`R$ ${d.total_pipeline_value.toLocaleString('pt-BR')}`} accent="text-blue-500" />
                            <StatCard label="Gargalo" value={d.bottleneck_stage || 'Nenhum'} accent={d.bottleneck_stage ? 'text-red-500' : 'text-green-500'} />
                        </div>
                        <div className="space-y-2">
                            {d.stages.map(s => (
                                <div key={s.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-black/20 rounded-lg text-xs">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">{s.name}</span>
                                    <div className="flex gap-3">
                                        <span>{s.deals_count} deals</span>
                                        <span>R$ {s.total_value.toLocaleString('pt-BR')}</span>
                                        <span className="text-slate-400">~{s.avg_days_in_stage}d</span>
                                        {s.stagnant_count > 0 && (
                                            <span className="text-red-500">⚠ {s.stagnant_count} parado(s)</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            }

            case 'team_performance': {
                const d = result.data;
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <StatCard label="Win Rate da Equipe" value={`${d.team_win_rate}%`} accent="text-blue-500" />
                            <StatCard label="Top Performer" value={d.top_performer || '-'} accent="text-amber-500" />
                        </div>
                        <div className="space-y-2">
                            {d.members.map((m, i) => (
                                <div key={m.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-black/20 rounded-lg text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-400">#{i + 1}</span>
                                        <span className="font-medium text-slate-700 dark:text-slate-300">{m.name}</span>
                                    </div>
                                    <div className="flex gap-3">
                                        <span className="text-green-500">{m.deals_won}W</span>
                                        <span className="text-red-400">{m.deals_lost}L</span>
                                        <span>{m.win_rate}%</span>
                                        <span className="text-slate-500">R$ {m.value_won.toLocaleString('pt-BR')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            }

            case 'activity_report': {
                const d = result.data;
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <StatCard label="Total" value={d.total_activities} accent="text-blue-500" />
                            <StatCard label="Concluídas" value={d.completed} accent="text-green-500" />
                            <StatCard label="Atrasadas" value={d.overdue} accent="text-red-500" />
                            <StatCard label="Taxa de Conclusão" value={`${d.completion_rate}%`} accent="text-indigo-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 dark:bg-black/20 rounded-lg p-3">
                                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Por Tipo</h4>
                                {d.by_type.map(t => (
                                    <div key={t.type} className="flex justify-between text-xs py-0.5">
                                        <span className="text-slate-600 dark:text-slate-300">{t.type}</span>
                                        <span className="font-medium">{t.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            }
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-emerald-500" />
                    Relatórios Rápidos
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Gere relatórios on-demand sobre vendas, pipeline e equipe.
                </p>
            </div>

            {/* Report Type Selection */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {REPORT_TYPES.map(rt => {
                    const Icon = rt.icon;
                    const isSelected = selectedType === rt.id;
                    return (
                        <button
                            key={rt.id}
                            onClick={() => setSelectedType(rt.id)}
                            className={`p-3 rounded-xl border text-left transition-all ${isSelected
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30'
                                    : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-slate-300'
                                }`}
                        >
                            <Icon className={`w-5 h-5 mb-2 ${isSelected ? 'text-emerald-500' : 'text-slate-400'}`} />
                            <div className="text-xs font-semibold text-slate-900 dark:text-white">{rt.label}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{rt.description}</div>
                        </button>
                    );
                })}
            </div>

            {/* Period + Generate */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300"
                    >
                        <option value="7d">Últimos 7 dias</option>
                        <option value="30d">Últimos 30 dias</option>
                        <option value="90d">Últimos 90 dias</option>
                        <option value="12m">Últimos 12 meses</option>
                    </select>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={report.isPending}
                    className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                    {report.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <BarChart3 className="w-4 h-4" />
                    )}
                    Gerar Relatório
                </button>
            </div>

            {/* Error */}
            {report.isError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-lg text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    {report.error?.message || 'Erro ao gerar relatório'}
                </div>
            )}

            {/* Report Results */}
            {report.data && (
                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5">
                    {renderReport(report.data)}
                </div>
            )}
        </div>
    );
};

/* Simple stat card */
const StatCard: React.FC<{ label: string; value: string | number; accent: string }> = ({ label, value, accent }) => (
    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-center">
        <div className={`text-lg font-bold ${accent}`}>{value}</div>
        <div className="text-[10px] text-slate-400 mt-0.5">{label}</div>
    </div>
);

export default QuickReportsPanel;
