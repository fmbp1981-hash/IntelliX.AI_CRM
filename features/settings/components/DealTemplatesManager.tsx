/**
 * Deal Templates Manager Component
 *
 * UI para CRUD de templates de deals.
 * Lista templates existentes, permite criar novos com defaults configuráveis.
 */
import React, { useState } from 'react';
import {
    FileText,
    Plus,
    Trash2,
    Save,
    Edit3,
    X,
    ChevronDown,
    ChevronUp,
    Copy,
    ToggleLeft,
    ToggleRight,
    Loader2,
    Zap,
    DollarSign,
    Tag,
} from 'lucide-react';
import {
    useDealTemplates,
    useCreateDealTemplate,
    useDeleteDealTemplate,
} from '@/features/boards/hooks/useDealTemplates';
import type { DealTemplate, CreateTemplatePayload, DealDefaults } from '@/lib/supabase/deal-templates';

const EMPTY_DEFAULTS: DealDefaults = {
    title_prefix: '',
    value: 0,
};

export const DealTemplatesManager: React.FC = () => {
    const { data: templates, isLoading } = useDealTemplates();
    const createTemplate = useCreateDealTemplate();
    const deleteTemplate = useDeleteDealTemplate();

    const [showCreate, setShowCreate] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formTitlePrefix, setFormTitlePrefix] = useState('');
    const [formValue, setFormValue] = useState<number>(0);

    const resetForm = () => {
        setFormName('');
        setFormDescription('');
        setFormTitlePrefix('');
        setFormValue(0);
        setShowCreate(false);
    };

    const handleSave = async () => {
        const defaults: DealDefaults = {};
        if (formTitlePrefix.trim()) defaults.title_prefix = formTitlePrefix.trim();
        if (formValue > 0) defaults.value = formValue;

        const payload: CreateTemplatePayload = {
            name: formName.trim(),
            description: formDescription.trim() || undefined,
            defaults,
        };

        await createTemplate.mutateAsync(payload);
        resetForm();
    };

    const handleDelete = async (id: string) => {
        if (confirm('Excluir este template? Deals existentes não serão afetados.')) {
            await deleteTemplate.mutateAsync(id);
        }
    };

    const isSaving = createTemplate.isPending;

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-6 h-6 text-emerald-500" />
                        Templates de Deal
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Crie templates com valores padrão para agilizar a criação de deals.
                    </p>
                </div>
                {!showCreate && (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Template
                    </button>
                )}
            </div>

            {/* Create Form */}
            {showCreate && (
                <div className="bg-white dark:bg-white/5 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                        Novo Template
                    </h3>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nome *</label>
                                <input
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="Ex: Deal Padrão SaaS"
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Descrição</label>
                                <input
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    placeholder="Opcional"
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Defaults */}
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Valores Padrão</label>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Prefixo do Título</label>
                                    <input
                                        value={formTitlePrefix}
                                        onChange={(e) => setFormTitlePrefix(e.target.value)}
                                        placeholder="Ex: [SaaS]"
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Valor Padrão (R$)</label>
                                    <input
                                        type="number"
                                        value={formValue || ''}
                                        onChange={(e) => setFormValue(Number(e.target.value))}
                                        min={0}
                                        placeholder="0,00"
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mt-5">
                        <button
                            onClick={handleSave}
                            disabled={!formName.trim() || isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Criar Template
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

            {/* Templates List */}
            {isLoading ? (
                <div className="py-12 text-center">
                    <Loader2 className="w-6 h-6 text-slate-400 animate-spin mx-auto" />
                </div>
            ) : !templates?.length ? (
                <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center">
                    <Zap className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Nenhum template criado</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Crie um template para agilizar a criação de deals com valores padrão.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {templates.map((tpl) => {
                        const isExpanded = expandedId === tpl.id;
                        const defaults = tpl.defaults as DealDefaults;
                        return (
                            <div
                                key={tpl.id}
                                className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden"
                            >
                                <div className="flex items-center justify-between p-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${tpl.is_active ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-slate-50 dark:bg-white/5'}`}>
                                            <FileText className={`w-4 h-4 ${tpl.is_active ? 'text-emerald-500' : 'text-slate-400'}`} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{tpl.name}</h4>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                {defaults?.value ? (
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                        <DollarSign className="w-3 h-3" />
                                                        {formatCurrency(defaults.value)}
                                                    </span>
                                                ) : null}
                                                {defaults?.title_prefix ? (
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                        <Tag className="w-3 h-3" />
                                                        {defaults.title_prefix}
                                                    </span>
                                                ) : null}
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${tpl.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'}`}>
                                                    {tpl.is_active ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleDelete(tpl.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                            title="Excluir"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : tpl.id)}
                                            className="p-1.5 text-slate-400 transition-colors"
                                        >
                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="border-t border-slate-100 dark:border-white/5 px-4 py-3 space-y-2">
                                        {tpl.description && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{tpl.description}</p>
                                        )}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-slate-50 dark:bg-black/20 rounded-lg p-3">
                                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Prefixo do Título</span>
                                                <p className="text-sm text-slate-900 dark:text-white mt-0.5">
                                                    {defaults?.title_prefix || '—'}
                                                </p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-black/20 rounded-lg p-3">
                                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Valor Padrão</span>
                                                <p className="text-sm text-slate-900 dark:text-white mt-0.5">
                                                    {defaults?.value ? formatCurrency(defaults.value) : '—'}
                                                </p>
                                            </div>
                                            {defaults?.tags?.length ? (
                                                <div className="bg-slate-50 dark:bg-black/20 rounded-lg p-3 col-span-2">
                                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tags</span>
                                                    <div className="flex gap-1 mt-1 flex-wrap">
                                                        {defaults.tags.map((t, i) => (
                                                            <span key={i} className="text-xs bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-400 px-2 py-0.5 rounded-full">
                                                                {t}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                                            Criado em {new Date(tpl.created_at).toLocaleDateString('pt-BR')}
                                        </p>
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

export default DealTemplatesManager;
