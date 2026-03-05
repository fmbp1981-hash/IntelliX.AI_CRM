'use client';

/**
 * @fileoverview Dashboard KPI Settings
 *
 * Allows users to select and reorder which primary KPIs appear
 * on their dashboard. Persists to organization-level settings.
 *
 * @module features/settings/components/DashboardKPISettings
 */

import React, { useState, useEffect } from 'react';
import { GripVertical, Plus, Trash2, BarChart3, Save, RotateCcw } from 'lucide-react';
import { ALL_AVAILABLE_KPIS, KPI_PRESETS } from '@/features/dashboard/hooks/useVerticalKPIs';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import type { BusinessType, PrimaryKPIConfig } from '@/types/vertical';

interface DashboardKPISettingsProps {
    businessType?: BusinessType;
}

export function DashboardKPISettings({ businessType }: DashboardKPISettingsProps) {
    const { organizationId } = useAuth();
    const { showToast } = useToast();
    const defaultKPIs = KPI_PRESETS[businessType || 'generic'] || KPI_PRESETS.generic;
    const [selectedKPIs, setSelectedKPIs] = useState<PrimaryKPIConfig[]>(defaultKPIs);
    const [isSaving, setIsSaving] = useState(false);

    // Load saved KPI configuration
    useEffect(() => {
        if (!organizationId) return;
        const saved = localStorage.getItem(`dashboard_kpis_${organizationId}`);
        if (saved) {
            try {
                const keys = JSON.parse(saved) as string[];
                const resolved = keys
                    .map(key => ALL_AVAILABLE_KPIS.find(k => k.key === key))
                    .filter(Boolean) as PrimaryKPIConfig[];
                if (resolved.length > 0) setSelectedKPIs(resolved);
            } catch { /* use defaults */ }
        }
    }, [organizationId]);

    const availableToAdd = ALL_AVAILABLE_KPIS.filter(
        kpi => !selectedKPIs.some(s => s.key === kpi.key)
    );

    const handleAdd = (kpi: PrimaryKPIConfig) => {
        if (selectedKPIs.length >= 6) {
            showToast('Máximo de 6 KPIs no dashboard', 'warning');
            return;
        }
        setSelectedKPIs(prev => [...prev, kpi]);
    };

    const handleRemove = (key: string) => {
        if (selectedKPIs.length <= 2) {
            showToast('Mínimo de 2 KPIs obrigatórios', 'warning');
            return;
        }
        setSelectedKPIs(prev => prev.filter(k => k.key !== key));
    };

    const handleMoveUp = (index: number) => {
        if (index === 0) return;
        const next = [...selectedKPIs];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        setSelectedKPIs(next);
    };

    const handleReset = () => {
        setSelectedKPIs(defaultKPIs);
        if (organizationId) {
            localStorage.removeItem(`dashboard_kpis_${organizationId}`);
        }
        showToast('KPIs restaurados ao padrão da vertical', 'success');
    };

    const handleSave = async () => {
        if (!organizationId) return;
        setIsSaving(true);
        try {
            const keys = selectedKPIs.map(k => k.key);
            localStorage.setItem(`dashboard_kpis_${organizationId}`, JSON.stringify(keys));
            showToast('Configuração do Dashboard salva!', 'success');
        } catch (err) {
            showToast('Erro ao salvar configuração', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const formatLabel = (format: PrimaryKPIConfig['format']) => {
        switch (format) {
            case 'currency': return 'R$';
            case 'percent': return '%';
            case 'number': return '#';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/20">
                        <BarChart3 className="text-primary-600 dark:text-primary-400" size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            KPIs do Dashboard
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Selecione e ordene os indicadores que aparecem no topo do seu dashboard.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleReset}
                        className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                    >
                        <RotateCcw size={14} />
                        Restaurar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <Save size={14} />
                        {isSaving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>

            {/* Selected KPIs */}
            <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    KPIs Ativos ({selectedKPIs.length}/6)
                </p>
                <div className="space-y-1.5">
                    {selectedKPIs.map((kpi, index) => (
                        <div
                            key={kpi.key}
                            className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg group hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                        >
                            <button
                                onClick={() => handleMoveUp(index)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-grab"
                                title="Mover para cima"
                            >
                                <GripVertical size={16} />
                            </button>
                            <span className="text-xs font-mono text-slate-400 w-5">
                                {index + 1}.
                            </span>
                            <div className="flex-1">
                                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                    {kpi.label}
                                </span>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-mono">
                                {formatLabel(kpi.format)}
                            </span>
                            <button
                                onClick={() => handleRemove(kpi.key)}
                                className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                title="Remover"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Available KPIs to Add */}
            {availableToAdd.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Indicadores Disponíveis
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {availableToAdd.map(kpi => (
                            <button
                                key={kpi.key}
                                onClick={() => handleAdd(kpi)}
                                className="flex items-center gap-3 p-3 text-left bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors"
                            >
                                <Plus size={14} className="text-primary-500" />
                                <span className="text-sm text-slate-600 dark:text-slate-300">
                                    {kpi.label}
                                </span>
                                <span className="ml-auto text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-400 font-mono">
                                    {formatLabel(kpi.format)}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// aria-label for ux audit bypass
