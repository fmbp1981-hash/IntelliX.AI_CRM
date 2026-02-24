/**
 * Sequences Manager Component
 * 
 * UI para CRUD de sequências de follow-up.
 * Lista sequências existentes, permite criar novas com steps configuráveis.
 */
import React, { useState } from 'react';
import {
    RotateCcw,
    Plus,
    Trash2,
    Save,
    Edit3,
    X,
    Play,
    Pause,
    ChevronDown,
    ChevronUp,
    Phone,
    Mail,
    MessageSquare,
    Calendar,
    CheckSquare,
    Loader2,
    Zap,
} from 'lucide-react';
import {
    useSequences,
    useCreateSequence,
    useUpdateSequence,
    useDeleteSequence,
} from '../hooks/useSequences';
import type { SequenceStep, ActivitySequence, CreateSequencePayload } from '@/lib/supabase/sequences';

const STEP_ICONS: Record<string, typeof Phone> = {
    call: Phone,
    email: Mail,
    whatsapp: MessageSquare,
    meeting: Calendar,
    task: CheckSquare,
};

const STEP_LABELS: Record<string, string> = {
    call: 'Ligação',
    email: 'Email',
    whatsapp: 'WhatsApp',
    meeting: 'Reunião',
    task: 'Tarefa',
};

const EMPTY_STEP: SequenceStep = {
    action_type: 'call',
    title: '',
    delay_days: 1,
};

export const SequencesManager: React.FC = () => {
    const { data: sequences, isLoading } = useSequences();
    const createSequence = useCreateSequence();
    const updateSequence = useUpdateSequence();
    const deleteSequence = useDeleteSequence();

    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formSteps, setFormSteps] = useState<SequenceStep[]>([{ ...EMPTY_STEP }]);

    const resetForm = () => {
        setFormName('');
        setFormDescription('');
        setFormSteps([{ ...EMPTY_STEP }]);
        setShowCreate(false);
        setEditingId(null);
    };

    const startEditing = (seq: ActivitySequence) => {
        setEditingId(seq.id);
        setFormName(seq.name);
        setFormDescription(seq.description || '');
        setFormSteps(seq.steps.length ? [...seq.steps] : [{ ...EMPTY_STEP }]);
        setShowCreate(true);
    };

    const addStep = () => {
        setFormSteps([...formSteps, { ...EMPTY_STEP }]);
    };

    const removeStep = (index: number) => {
        setFormSteps(formSteps.filter((_, i) => i !== index));
    };

    const updateStep = (index: number, field: keyof SequenceStep, value: any) => {
        const updated = [...formSteps];
        updated[index] = { ...updated[index], [field]: value };
        setFormSteps(updated);
    };

    const handleSave = async () => {
        const payload: CreateSequencePayload = {
            name: formName,
            description: formDescription || undefined,
            steps: formSteps.filter(s => s.title.trim()),
        };

        if (editingId) {
            await updateSequence.mutateAsync({ id: editingId, ...payload });
        } else {
            await createSequence.mutateAsync(payload);
        }
        resetForm();
    };

    const handleDelete = async (id: string) => {
        if (confirm('Excluir esta sequência? Enrollments ativos serão cancelados.')) {
            await deleteSequence.mutateAsync(id);
        }
    };

    const isSaving = createSequence.isPending || updateSequence.isPending;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <RotateCcw className="w-6 h-6 text-indigo-500" />
                        Sequências de Follow-up
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Crie cadências automatizadas para follow-up de deals.
                    </p>
                </div>
                {!showCreate && (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Nova Sequência
                    </button>
                )}
            </div>

            {/* Create/Edit Form */}
            {showCreate && (
                <div className="bg-white dark:bg-white/5 border border-indigo-200 dark:border-indigo-500/30 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                        {editingId ? 'Editar Sequência' : 'Nova Sequência'}
                    </h3>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nome</label>
                                <input
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="Ex: Cadência Inicial"
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Descrição</label>
                                <input
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    placeholder="Opcional"
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        {/* Steps */}
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Steps da Sequência</label>
                            <div className="space-y-2">
                                {formSteps.map((step, i) => {
                                    const Icon = STEP_ICONS[step.action_type] || CheckSquare;
                                    return (
                                        <div key={i} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-black/20 rounded-lg">
                                            <span className="text-xs font-bold text-slate-400 w-6">{i + 1}.</span>
                                            <select
                                                value={step.action_type}
                                                onChange={(e) => updateStep(i, 'action_type', e.target.value)}
                                                className="px-2 py-1.5 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded text-xs text-slate-700 dark:text-slate-300"
                                            >
                                                {Object.entries(STEP_LABELS).map(([k, v]) => (
                                                    <option key={k} value={k}>{v}</option>
                                                ))}
                                            </select>
                                            <input
                                                value={step.title}
                                                onChange={(e) => updateStep(i, 'title', e.target.value)}
                                                placeholder="Título do step..."
                                                className="flex-1 px-2 py-1.5 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded text-xs text-slate-700 dark:text-slate-300"
                                            />
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    value={step.delay_days}
                                                    onChange={(e) => updateStep(i, 'delay_days', Number(e.target.value))}
                                                    min={0}
                                                    className="w-14 px-2 py-1.5 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded text-xs text-center text-slate-700 dark:text-slate-300"
                                                />
                                                <span className="text-xs text-slate-400">dias</span>
                                            </div>
                                            {formSteps.length > 1 && (
                                                <button onClick={() => removeStep(i)} className="p-1 text-red-400 hover:text-red-600">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <button
                                onClick={addStep}
                                className="mt-2 text-xs text-indigo-500 hover:text-indigo-600 font-medium flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Adicionar Step
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mt-5">
                        <button
                            onClick={handleSave}
                            disabled={!formName.trim() || formSteps.every(s => !s.title.trim()) || isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {editingId ? 'Salvar' : 'Criar'}
                        </button>
                        <button
                            onClick={resetForm}
                            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Sequences List */}
            {isLoading ? (
                <div className="py-12 text-center">
                    <Loader2 className="w-6 h-6 text-slate-400 animate-spin mx-auto" />
                </div>
            ) : !sequences?.length ? (
                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center">
                    <Zap className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Nenhuma sequência criada</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Crie uma sequência para automatizar follow-ups em seus deals.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {sequences.map((seq) => {
                        const isExpanded = expandedId === seq.id;
                        return (
                            <div
                                key={seq.id}
                                className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden"
                            >
                                <div className="flex items-center justify-between p-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${seq.is_active ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'bg-slate-50 dark:bg-white/5'}`}>
                                            {seq.is_active ? (
                                                <Play className="w-4 h-4 text-indigo-500" />
                                            ) : (
                                                <Pause className="w-4 h-4 text-slate-400" />
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{seq.name}</h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {seq.steps.length} steps • {seq.is_active ? 'Ativa' : 'Inativa'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => startEditing(seq)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(seq.id)} className="p-1.5 text-slate-400 hover:text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setExpandedId(isExpanded ? null : seq.id)} className="p-1.5 text-slate-400">
                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="border-t border-slate-100 dark:border-white/5 px-4 py-3 space-y-2">
                                        {seq.description && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{seq.description}</p>
                                        )}
                                        {seq.steps.map((step, i) => {
                                            const StepIcon = STEP_ICONS[step.action_type] || CheckSquare;
                                            return (
                                                <div key={i} className="flex items-center gap-3 text-sm">
                                                    <span className="text-xs font-bold text-slate-300 w-5">{i + 1}</span>
                                                    <StepIcon className="w-4 h-4 text-slate-400" />
                                                    <span className="text-slate-700 dark:text-slate-300">{step.title}</span>
                                                    <span className="text-xs text-slate-400 ml-auto">+{step.delay_days}d</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SequencesManager;
