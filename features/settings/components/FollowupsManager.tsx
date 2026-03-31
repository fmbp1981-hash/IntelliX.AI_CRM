/**
 * Follow-ups Manager Component
 *
 * UI para configurar e gerenciar sequências de follow-up proativas.
 * Permite criar sequências por tipo e vertical, visualizar execuções ativas.
 */
import React, { useState } from 'react';
import {
    MessageSquare,
    Plus,
    Trash2,
    Save,
    ChevronDown,
    ChevronUp,
    Loader2,
    Zap,
    Clock,
    Play,
    Pause,
    XCircle,
    ToggleLeft,
    ToggleRight,
} from 'lucide-react';
import {
    useFollowupSequences,
    useCreateFollowupSequence,
    useDeleteFollowupSequence,
    useUpdateFollowupSequence,
    useFollowupExecutions,
    useCancelFollowupExecution,
} from '@/features/settings/hooks/useFollowups';
import type { FollowupSequence, FollowupStep } from '@/lib/supabase/followups';

const SEQUENCE_TYPES = [
    { value: 'quick', label: 'Quick Follow-up', desc: '30min — 24h', color: 'bg-blue-500' },
    { value: 'warm', label: 'Warm Follow-up', desc: '1-3 dias', color: 'bg-amber-500' },
    { value: 'pipeline', label: 'Pipeline Follow-up', desc: '3-14 dias', color: 'bg-indigo-500' },
    { value: 'remarketing', label: 'Remarketing', desc: '15-90 dias', color: 'bg-rose-500' },
    { value: 'reactivation', label: 'Reativação', desc: '3-12+ meses', color: 'bg-slate-500' },
] as const;

const VERTICAL_TYPES = [
    { value: 'generic', label: 'Genérico (B2B)' },
    { value: 'medical_clinic', label: 'Clínica Médica' },
    { value: 'dental_clinic', label: 'Clínica Odontológica' },
    { value: 'real_estate', label: 'Imobiliária' },
] as const;

const DEFAULT_STEP: FollowupStep = {
    step_number: 1,
    delay_minutes: 60,
    message_type: 'ai_generated',
    message_prompt: '',
    channel: 'whatsapp',
    fallback_to_template: true,
    create_inbox_item: false,
    max_retry: 1,
};

function formatDelay(minutes: number): string {
    if (minutes < 60) return `${minutes}min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
}

export const FollowupsManager: React.FC = () => {
    const { data: sequences, isLoading } = useFollowupSequences();
    const { data: executions } = useFollowupExecutions({ status: 'active' });
    const createSequence = useCreateFollowupSequence();
    const deleteSequence = useDeleteFollowupSequence();
    const updateSequence = useUpdateFollowupSequence();
    const cancelExecution = useCancelFollowupExecution();

    const [showCreate, setShowCreate] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'sequences' | 'executions'>('sequences');

    // Form state
    const [formName, setFormName] = useState('');
    const [formType, setFormType] = useState<string>('warm');
    const [formVertical, setFormVertical] = useState<string>('generic');
    const [formSteps, setFormSteps] = useState<FollowupStep[]>([{ ...DEFAULT_STEP }]);

    const resetForm = () => {
        setFormName('');
        setFormType('warm');
        setFormVertical('generic');
        setFormSteps([{ ...DEFAULT_STEP }]);
        setShowCreate(false);
    };

    const addStep = () => {
        setFormSteps(prev => [...prev, {
            ...DEFAULT_STEP,
            step_number: prev.length + 1,
            delay_minutes: prev.length === 0 ? 60 : 1440,
        }]);
    };

    const removeStep = (index: number) => {
        setFormSteps(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_number: i + 1 })));
    };

    const updateStep = (index: number, field: keyof FollowupStep, value: any) => {
        setFormSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
    };

    const handleSave = async () => {
        await createSequence.mutateAsync({
            name: formName.trim(),
            sequence_type: formType as FollowupSequence['sequence_type'],
            vertical_type: formVertical as FollowupSequence['vertical_type'],
            steps: formSteps,
            trigger_condition: { type: 'conversation_idle', idle_minutes: formType === 'quick' ? 30 : 2880 },
        });
        resetForm();
    };

    const handleToggle = async (seq: FollowupSequence) => {
        await updateSequence.mutateAsync({ sequenceId: seq.id, is_active: !seq.is_active });
    };

    const handleDelete = async (id: string) => {
        if (confirm('Excluir esta sequência? Execuções ativas serão canceladas.')) {
            await deleteSequence.mutateAsync(id);
        }
    };

    const isSaving = createSequence.isPending;
    const activeExecCount = executions?.length || 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MessageSquare className="w-6 h-6 text-blue-500" />
                        Follow-ups Proativos
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Configure sequências automatizadas de nurturing por tipo e vertical.
                    </p>
                </div>
                {!showCreate && activeTab === 'sequences' && (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Nova Sequência
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-white/5 rounded-lg p-1">
                <button
                    onClick={() => setActiveTab('sequences')}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'sequences' ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                >
                    Sequências {sequences?.length ? `(${sequences.length})` : ''}
                </button>
                <button
                    onClick={() => setActiveTab('executions')}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'executions' ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                >
                    Execuções Ativas {activeExecCount > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 rounded-full text-xs">{activeExecCount}</span>
                    )}
                </button>
            </div>

            {/* Create Form */}
            {showCreate && activeTab === 'sequences' && (
                <div className="bg-white dark:bg-white/5 border border-blue-200 dark:border-blue-500/30 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Nova Sequência</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nome *</label>
                                <input
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="Ex: Warm follow-up SaaS"
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Tipo</label>
                                <select
                                    value={formType}
                                    onChange={(e) => setFormType(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {SEQUENCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label} ({t.desc})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Vertical</label>
                                <select
                                    value={formVertical}
                                    onChange={(e) => setFormVertical(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {VERTICAL_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Steps Builder */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Steps ({formSteps.length})</label>
                                <button
                                    onClick={addStep}
                                    className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
                                >
                                    <Plus className="w-3 h-3" /> Adicionar Step
                                </button>
                            </div>
                            <div className="space-y-2">
                                {formSteps.map((step, i) => (
                                    <div key={i} className="flex items-start gap-3 bg-slate-50 dark:bg-black/20 rounded-lg p-3">
                                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-bold flex-shrink-0 mt-1">
                                            {i + 1}
                                        </div>
                                        <div className="flex-1 grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-0.5">Delay</label>
                                                <div className="flex gap-1">
                                                    <input
                                                        type="number"
                                                        value={step.delay_minutes}
                                                        onChange={(e) => updateStep(i, 'delay_minutes', Number(e.target.value))}
                                                        min={1}
                                                        className="w-20 px-2 py-1 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded text-xs text-slate-700 dark:text-slate-300"
                                                    />
                                                    <span className="text-xs text-slate-400 self-center">min</span>
                                                </div>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-0.5">Instrução para IA</label>
                                                <input
                                                    value={step.message_prompt}
                                                    onChange={(e) => updateStep(i, 'message_prompt', e.target.value)}
                                                    placeholder="Ex: Retomada gentil referenciando interesse..."
                                                    className="w-full px-2 py-1 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded text-xs text-slate-700 dark:text-slate-300"
                                                />
                                            </div>
                                        </div>
                                        {formSteps.length > 1 && (
                                            <button onClick={() => removeStep(i)} className="text-slate-400 hover:text-red-500 mt-1">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mt-5">
                        <button
                            onClick={handleSave}
                            disabled={!formName.trim() || !formSteps.some(s => s.message_prompt.trim()) || isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Criar Sequência
                        </button>
                        <button onClick={resetForm} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Sequences Tab */}
            {activeTab === 'sequences' && (
                isLoading ? (
                    <div className="py-12 text-center"><Loader2 className="w-6 h-6 text-slate-400 animate-spin mx-auto" /></div>
                ) : !sequences?.length ? (
                    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center">
                        <Zap className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Nenhuma sequência configurada</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Crie sequências de follow-up para nutrir leads automaticamente.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sequences.map((seq) => {
                            const isExpanded = expandedId === seq.id;
                            const steps = seq.steps as FollowupStep[];
                            const typeInfo = SEQUENCE_TYPES.find(t => t.value === seq.sequence_type);
                            const verticalInfo = VERTICAL_TYPES.find(v => v.value === seq.vertical_type);

                            return (
                                <div key={seq.id} className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                                    <div className="flex items-center justify-between p-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-10 rounded-full ${typeInfo?.color || 'bg-slate-400'}`} />
                                            <div>
                                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{seq.name}</h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">{typeInfo?.label}</span>
                                                    <span className="text-xs text-slate-400">•</span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">{verticalInfo?.label}</span>
                                                    <span className="text-xs text-slate-400">•</span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />{steps.length} steps
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleToggle(seq)} className="p-1.5 transition-colors" title={seq.is_active ? 'Desativar' : 'Ativar'}>
                                                {seq.is_active
                                                    ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                                                    : <ToggleLeft className="w-5 h-5 text-slate-400" />
                                                }
                                            </button>
                                            <button onClick={() => handleDelete(seq.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setExpandedId(isExpanded ? null : seq.id)} className="p-1.5 text-slate-400 transition-colors">
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="border-t border-slate-100 dark:border-white/5 px-4 py-3">
                                            <div className="space-y-2">
                                                {steps.map((step, i) => (
                                                    <div key={i} className="flex items-start gap-2">
                                                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-bold flex-shrink-0 mt-0.5">
                                                            {i + 1}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" /> {formatDelay(step.delay_minutes)}
                                                                </span>
                                                                <span className="text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 text-slate-500 rounded">
                                                                    {step.message_type === 'ai_generated' ? 'IA' : 'Template'}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{step.message_prompt || '—'}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-3 mt-3 pt-2 border-t border-slate-50 dark:border-white/5">
                                                <span className="text-xs text-slate-400">Rate limit: {seq.max_messages_per_day}/dia</span>
                                                <span className="text-xs text-slate-400">• Min {seq.min_hours_between_messages}h entre msgs</span>
                                                {seq.respect_business_hours && <span className="text-xs text-slate-400">• Horário comercial</span>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {/* Executions Tab */}
            {activeTab === 'executions' && (
                !executions?.length ? (
                    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center">
                        <Play className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Nenhuma execução ativa</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Execuções aparecem aqui quando sequências são ativadas para leads.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {executions.map((exec) => (
                            <div key={exec.id} className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                                            {(exec as any).sequence?.name || 'Sequência'}
                                        </h4>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                Step {exec.current_step + 1} • {exec.messages_sent} msgs enviadas
                                            </span>
                                            {exec.next_scheduled_at && (
                                                <span className="text-xs text-blue-500 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    Próximo: {new Date(exec.next_scheduled_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => cancelExecution.mutateAsync({ executionId: exec.id, reason: 'manual_stop' })}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <XCircle className="w-3.5 h-3.5" /> Cancelar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
};

export default FollowupsManager;
