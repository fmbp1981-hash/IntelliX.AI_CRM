'use client';

import React, { useState } from 'react';
import { useAgentConfig } from '@/hooks/useAgentConfig';

type TabId = 'connection' | 'behavior' | 'hours' | 'qualification' | 'transfer' | 'metrics';

const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'connection', label: 'Conexão', icon: '📱' },
    { id: 'behavior', label: 'Comportamento', icon: '🧠' },
    { id: 'hours', label: 'Horários', icon: '🕐' },
    { id: 'qualification', label: 'Qualificação', icon: '📋' },
    { id: 'transfer', label: 'Transferência', icon: '🔄' },
    { id: 'metrics', label: 'Métricas', icon: '📊' },
];

const DAYS = [
    { key: 'monday', label: 'Segunda' },
    { key: 'tuesday', label: 'Terça' },
    { key: 'wednesday', label: 'Quarta' },
    { key: 'thursday', label: 'Quinta' },
    { key: 'friday', label: 'Sexta' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
];

export const AgentConfigPage: React.FC = () => {
    const { data: config, updateConfig } = useAgentConfig();
    const [activeTab, setActiveTab] = useState<TabId>('connection');
    const [draft, setDraft] = useState<Record<string, any>>({});
    const [saving, setSaving] = useState(false);

    if (!config) {
        return (
            <div className="max-w-4xl mx-auto py-8 px-6">
                <div className="flex items-center justify-center h-40">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    const merged = { ...config, ...draft };

    const updateDraft = (key: string, value: any) =>
        setDraft((prev) => ({ ...prev, [key]: value }));

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateConfig.mutateAsync(draft);
            setDraft({});
        } finally {
            setSaving(false);
        }
    };

    const hasDraftChanges = Object.keys(draft).length > 0;

    return (
        <div className="max-w-4xl mx-auto py-8 px-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold font-display text-slate-900 dark:text-white mb-1">
                        NossoAgent
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Configure o comportamento do seu assistente de IA
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Active toggle */}
                    <button
                        onClick={() => updateDraft('is_active', !merged.is_active)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${merged.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/20'
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${merged.is_active ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                    <span className={`text-sm font-medium ${merged.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {merged.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-white/10">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.id
                                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <span className="mr-1.5">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="space-y-6">
                {activeTab === 'connection' && (
                    <>
                        <FieldGroup label="Provider WhatsApp">
                            <select
                                value={merged.whatsapp_provider ?? 'evolution_api'}
                                onChange={(e) => updateDraft('whatsapp_provider', e.target.value)}
                                className="input-field"
                            >
                                <option value="whatsapp_cloud_api">WhatsApp Cloud API (Meta)</option>
                                <option value="evolution_api">Evolution API</option>
                            </select>
                        </FieldGroup>

                        <FieldGroup label="Nome do Agente">
                            <input
                                type="text"
                                value={merged.agent_name ?? ''}
                                onChange={(e) => updateDraft('agent_name', e.target.value)}
                                placeholder="NossoAgent"
                                className="input-field"
                            />
                        </FieldGroup>

                        <FieldGroup label="Mensagem de Boas-vindas">
                            <textarea
                                value={merged.welcome_message ?? ''}
                                onChange={(e) => updateDraft('welcome_message', e.target.value)}
                                rows={3}
                                placeholder="Olá! 👋 Como posso ajudar você hoje?"
                                className="input-field"
                            />
                        </FieldGroup>

                        <FieldGroup label="Mensagem de Transferência">
                            <textarea
                                value={merged.transfer_message ?? ''}
                                onChange={(e) => updateDraft('transfer_message', e.target.value)}
                                rows={2}
                                placeholder="Vou transferir para um de nossos especialistas..."
                                className="input-field"
                            />
                        </FieldGroup>

                        <FieldGroup label="Mensagem Fora do Horário">
                            <textarea
                                value={merged.outside_hours_message ?? ''}
                                onChange={(e) => updateDraft('outside_hours_message', e.target.value)}
                                rows={2}
                                placeholder="Nosso horário de atendimento é de segunda a sexta..."
                                className="input-field"
                            />
                        </FieldGroup>
                    </>
                )}

                {activeTab === 'behavior' && (
                    <>
                        <FieldGroup label="Modelo de IA">
                            <select
                                value={merged.ai_model ?? 'claude-sonnet-4-20250514'}
                                onChange={(e) => updateDraft('ai_model', e.target.value)}
                                className="input-field"
                            >
                                <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (recomendado)</option>
                                <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (rápido)</option>
                                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                            </select>
                        </FieldGroup>

                        <FieldGroup label="Temperatura">
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={merged.ai_temperature ?? 0.7}
                                    onChange={(e) => updateDraft('ai_temperature', parseFloat(e.target.value))}
                                    className="flex-1"
                                />
                                <span className="text-sm font-mono text-slate-600 dark:text-slate-300 w-8 text-right">
                                    {merged.ai_temperature ?? 0.7}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">
                                Menor = mais preciso e conservador. Maior = mais criativo.
                            </p>
                        </FieldGroup>

                        <FieldGroup label="Max Tokens por Resposta">
                            <input
                                type="number"
                                value={merged.max_tokens_per_response ?? 500}
                                onChange={(e) => updateDraft('max_tokens_per_response', parseInt(e.target.value))}
                                min={100}
                                max={2000}
                                className="input-field"
                            />
                        </FieldGroup>

                        <FieldGroup label="Prompt Override (opcional)">
                            <textarea
                                value={merged.system_prompt_override ?? ''}
                                onChange={(e) => updateDraft('system_prompt_override', e.target.value)}
                                rows={6}
                                placeholder="Instruções adicionais para o agente. Ex: 'Sempre mencione nossa promoção de janeiro...'&#10;Deixe vazio para usar o prompt padrão."
                                className="input-field font-mono text-xs"
                            />
                        </FieldGroup>
                    </>
                )}

                {activeTab === 'hours' && (
                    <>
                        <div className="flex items-center gap-3 mb-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={merged.attend_outside_hours ?? false}
                                    onChange={(e) => updateDraft('attend_outside_hours', e.target.checked)}
                                    className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                    Atender fora do horário comercial
                                </span>
                            </label>
                        </div>

                        <FieldGroup label="Fuso Horário">
                            <select
                                value={merged.timezone ?? 'America/Sao_Paulo'}
                                onChange={(e) => updateDraft('timezone', e.target.value)}
                                className="input-field"
                            >
                                <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                                <option value="America/Manaus">Manaus (GMT-4)</option>
                                <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
                                <option value="America/Bahia">Bahia (GMT-3)</option>
                            </select>
                        </FieldGroup>

                        <div className="space-y-2">
                            {DAYS.map((day) => {
                                const hours = (merged.business_hours ?? {})[day.key] ?? { start: '09:00', end: '18:00', active: day.key !== 'sunday' && day.key !== 'saturday' };
                                return (
                                    <div key={day.key} className="flex items-center gap-3 py-2">
                                        <label className="flex items-center gap-2 w-24">
                                            <input
                                                type="checkbox"
                                                checked={hours.active}
                                                onChange={(e) => {
                                                    const newHours = { ...(merged.business_hours ?? {}), [day.key]: { ...hours, active: e.target.checked } };
                                                    updateDraft('business_hours', newHours);
                                                }}
                                                className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                            />
                                            <span className="text-sm text-slate-700 dark:text-slate-300">{day.label}</span>
                                        </label>
                                        {hours.active && (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="time"
                                                    value={hours.start ?? '09:00'}
                                                    onChange={(e) => {
                                                        const newHours = { ...(merged.business_hours ?? {}), [day.key]: { ...hours, start: e.target.value } };
                                                        updateDraft('business_hours', newHours);
                                                    }}
                                                    className="input-field-sm"
                                                />
                                                <span className="text-slate-400">até</span>
                                                <input
                                                    type="time"
                                                    value={hours.end ?? '18:00'}
                                                    onChange={(e) => {
                                                        const newHours = { ...(merged.business_hours ?? {}), [day.key]: { ...hours, end: e.target.value } };
                                                        updateDraft('business_hours', newHours);
                                                    }}
                                                    className="input-field-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {activeTab === 'qualification' && (
                    <>
                        <div className="flex items-center gap-3 mb-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={merged.auto_create_contact ?? true}
                                    onChange={(e) => updateDraft('auto_create_contact', e.target.checked)}
                                    className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                    Criar contato automaticamente quando qualificado
                                </span>
                            </label>
                        </div>

                        <div className="flex items-center gap-3 mb-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={merged.auto_create_deal ?? true}
                                    onChange={(e) => updateDraft('auto_create_deal', e.target.checked)}
                                    className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                    Criar deal automaticamente quando qualificado
                                </span>
                            </label>
                        </div>

                        <FieldGroup label="Campos de Qualificação">
                            <div className="space-y-2">
                                {(merged.qualification_fields ?? []).map((field: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 rounded-lg p-2">
                                        <input
                                            type="text"
                                            value={field.key}
                                            onChange={(e) => {
                                                const fields = [...(merged.qualification_fields ?? [])];
                                                fields[idx] = { ...fields[idx], key: e.target.value };
                                                updateDraft('qualification_fields', fields);
                                            }}
                                            placeholder="Chave (ex: nome)"
                                            className="input-field-sm flex-1"
                                        />
                                        <input
                                            type="text"
                                            value={field.question}
                                            onChange={(e) => {
                                                const fields = [...(merged.qualification_fields ?? [])];
                                                fields[idx] = { ...fields[idx], question: e.target.value };
                                                updateDraft('qualification_fields', fields);
                                            }}
                                            placeholder="Pergunta para o lead"
                                            className="input-field-sm flex-[2]"
                                        />
                                        <label className="flex items-center gap-1">
                                            <input
                                                type="checkbox"
                                                checked={field.required}
                                                onChange={(e) => {
                                                    const fields = [...(merged.qualification_fields ?? [])];
                                                    fields[idx] = { ...fields[idx], required: e.target.checked };
                                                    updateDraft('qualification_fields', fields);
                                                }}
                                                className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                            />
                                            <span className="text-[10px] text-slate-400">Obrig.</span>
                                        </label>
                                        <button
                                            onClick={() => {
                                                const fields = (merged.qualification_fields ?? []).filter((_: any, i: number) => i !== idx);
                                                updateDraft('qualification_fields', fields);
                                            }}
                                            className="text-red-400 hover:text-red-500 text-sm"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => {
                                        const fields = [...(merged.qualification_fields ?? []), { key: '', question: '', required: false }];
                                        updateDraft('qualification_fields', fields);
                                    }}
                                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                                >
                                    + Adicionar campo
                                </button>
                            </div>
                        </FieldGroup>
                    </>
                )}

                {activeTab === 'transfer' && (
                    <>
                        <FieldGroup label="Max Mensagens Antes de Transferir">
                            <input
                                type="number"
                                value={merged.max_messages_before_transfer ?? ''}
                                onChange={(e) => updateDraft('max_messages_before_transfer', e.target.value ? parseInt(e.target.value) : null)}
                                placeholder="Sem limite"
                                min={1}
                                className="input-field"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                                Se definido, a IA transferirá automaticamente após N mensagens sem qualificação completa.
                            </p>
                        </FieldGroup>

                        <FieldGroup label="Regras de Transferência">
                            <div className="space-y-2">
                                {(merged.transfer_rules ?? []).map((rule: any, idx: number) => (
                                    <div key={idx} className="bg-slate-50 dark:bg-white/5 rounded-lg p-3 space-y-2">
                                        <input
                                            type="text"
                                            value={rule.condition}
                                            onChange={(e) => {
                                                const rules = [...(merged.transfer_rules ?? [])];
                                                rules[idx] = { ...rules[idx], condition: e.target.value };
                                                updateDraft('transfer_rules', rules);
                                            }}
                                            placeholder="Condição (ex: reclamação, pedido orçamento)"
                                            className="input-field-sm w-full"
                                        />
                                        <input
                                            type="text"
                                            value={rule.message}
                                            onChange={(e) => {
                                                const rules = [...(merged.transfer_rules ?? [])];
                                                rules[idx] = { ...rules[idx], message: e.target.value };
                                                updateDraft('transfer_rules', rules);
                                            }}
                                            placeholder="Mensagem ao transferir"
                                            className="input-field-sm w-full"
                                        />
                                        <button
                                            onClick={() => {
                                                const rules = (merged.transfer_rules ?? []).filter((_: any, i: number) => i !== idx);
                                                updateDraft('transfer_rules', rules);
                                            }}
                                            className="text-xs text-red-400 hover:text-red-500"
                                        >
                                            Remover regra
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => {
                                        const rules = [...(merged.transfer_rules ?? []), { condition: '', transfer_to: '', message: '' }];
                                        updateDraft('transfer_rules', rules);
                                    }}
                                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                                >
                                    + Adicionar regra
                                </button>
                            </div>
                        </FieldGroup>
                    </>
                )}

                {activeTab === 'metrics' && (
                    <div className="text-center py-12">
                        <span className="text-4xl mb-4 block">📊</span>
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Métricas em breve
                        </h3>
                        <p className="text-sm text-slate-400 max-w-md mx-auto">
                            Aqui você verá: total de conversas, tempo médio de resposta, taxa de qualificação,
                            transferências, e satisfaction score.
                        </p>
                    </div>
                )}
            </div>

            {/* Save bar */}
            {hasDraftChanges && (
                <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/10 px-6 py-3 flex items-center justify-end gap-3 z-50 shadow-lg">
                    <span className="text-sm text-slate-500 mr-auto">Alterações não salvas</span>
                    <button
                        onClick={() => setDraft({})}
                        className="px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 text-sm rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                    >
                        {saving ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                </div>
            )}

            {/* Utility styles */}
            <style>{`
        .input-field {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          border-radius: 0.5rem;
          border: 1px solid rgb(226 232 240);
          background: rgb(248 250 252);
          color: rgb(15 23 42);
        }
        .dark .input-field {
          border-color: rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          color: white;
        }
        .input-field:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(16 185 129 / 0.4);
        }
        .input-field-sm {
          padding: 0.375rem 0.5rem;
          font-size: 0.75rem;
          border-radius: 0.375rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          color: rgb(15 23 42);
        }
        .dark .input-field-sm {
          border-color: rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          color: white;
        }
        .input-field-sm:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(16 185 129 / 0.4);
        }
      `}</style>
        </div>
    );
};

// ── Helper Component ──

const FieldGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            {label}
        </label>
        {children}
    </div>
);
