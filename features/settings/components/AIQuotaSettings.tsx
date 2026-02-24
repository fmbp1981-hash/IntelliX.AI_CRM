/**
 * AI Quota Settings Component
 * 
 * Formulário para admins configurarem a quota de IA da organização.
 * Campos: limite mensal de tokens, dia do reset, threshold de alerta.
 */
import React, { useState } from 'react';
import { Shield, Save, Loader2 } from 'lucide-react';
import { useAIQuotaStatus, useUpdateAIQuota } from '../hooks/useAIGovernance';
import { useAuth } from '@/context/AuthContext';

export const AIQuotaSettings: React.FC = () => {
    const { profile } = useAuth();
    const { data: quota } = useAIQuotaStatus();
    const updateQuota = useUpdateAIQuota();

    const isAdmin = profile?.role === 'admin';

    const [limit, setLimit] = useState<number>(quota?.monthly_limit_tokens ?? 100000);
    const [resetDay, setResetDay] = useState<number>(quota?.reset_day ?? 1);
    const [alertPct, setAlertPct] = useState<number>(quota?.alert_threshold_pct ?? 80);

    // Sync state when quota loads
    React.useEffect(() => {
        if (quota) {
            setLimit(quota.monthly_limit_tokens);
            setResetDay(quota.reset_day);
            setAlertPct(quota.alert_threshold_pct);
        }
    }, [quota]);

    if (!isAdmin) {
        return (
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center">
                <Shield className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    Acesso Restrito
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Apenas administradores podem gerenciar quotas de IA.
                </p>
            </div>
        );
    }

    const handleSave = () => {
        updateQuota.mutate({
            monthly_token_limit: limit,
            reset_day: resetDay,
            alert_threshold_pct: alertPct,
        });
    };

    return (
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Configuração de Quota
            </h3>

            <div className="space-y-4">
                {/* Monthly Token Limit */}
                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                        Limite Mensal de Tokens
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="number"
                            value={limit}
                            onChange={(e) => setLimit(Number(e.target.value))}
                            min={0}
                            step={10000}
                            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="0 = sem limite"
                        />
                        <span className="text-sm text-slate-400">tokens</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        Defina 0 para desabilitar o limite de quota.
                    </p>
                </div>

                {/* Reset Day */}
                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                        Dia do Reset Mensal
                    </label>
                    <select
                        value={resetDay}
                        onChange={(e) => setResetDay(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                            <option key={day} value={day}>Dia {day}</option>
                        ))}
                    </select>
                </div>

                {/* Alert Threshold */}
                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                        Alerta ao Atingir (%)
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min={50}
                            max={100}
                            value={alertPct}
                            onChange={(e) => setAlertPct(Number(e.target.value))}
                            className="flex-1 accent-primary-500"
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 w-12 text-right">
                            {alertPct}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="mt-6 flex items-center justify-between">
                {updateQuota.isSuccess && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">
                        ✓ Configuração salva com sucesso
                    </p>
                )}
                {updateQuota.isError && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                        Erro: {(updateQuota.error as any)?.message || 'Falha ao salvar'}
                    </p>
                )}
                {!updateQuota.isSuccess && !updateQuota.isError && <div />}

                <button
                    onClick={handleSave}
                    disabled={updateQuota.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
                >
                    {updateQuota.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    Salvar
                </button>
            </div>
        </div>
    );
};

export default AIQuotaSettings;
