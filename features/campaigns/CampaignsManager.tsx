'use client';

/**
 * @fileoverview CampaignsManager — Gerenciador de Campanhas de Email
 *
 * UI completo para criar, gerenciar e disparar campanhas de email segmentadas.
 * Integrado na aba "Campanhas" da página de Configurações.
 */

import React, { useState } from 'react';
import {
    Mail, Plus, Send, Trash2, Eye, Sparkles, Users, ChevronDown,
    BarChart2, Clock, CheckCircle2, XCircle, Loader2, FileText,
} from 'lucide-react';
import {
    useCampaigns,
    useCreateCampaign,
    useDeleteCampaign,
    useSendCampaign,
    useUpdateCampaign,
    useSegmentPreview,
} from './hooks/useCampaigns';
import {
    useEmailTemplates,
    useCreateEmailTemplate,
    useDeleteEmailTemplate,
    useGenerateEmailTemplate,
} from './hooks/useEmailTemplates';
import type { EmailCampaign, EmailTemplate, SegmentFilters, CampaignMetrics } from '@/lib/supabase/email-campaigns';
import { computeMetrics } from '@/lib/supabase/email-campaigns';

// ── Status Badge ─────────────────────────────────────────
const STATUS_LABELS: Record<string, { label: string; className: string }> = {
    draft:     { label: 'Rascunho',  className: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
    scheduled: { label: 'Agendada', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
    sending:   { label: 'Enviando', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
    sent:      { label: 'Enviada',  className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' },
    paused:    { label: 'Pausada',  className: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300' },
    cancelled: { label: 'Cancelada',className: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
};

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_LABELS[status] ?? STATUS_LABELS.draft;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
            {cfg.label}
        </span>
    );
}

// ── Metrics Row ──────────────────────────────────────────
function MetricsRow({ metrics }: { metrics: CampaignMetrics }) {
    return (
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><Send className="w-3.5 h-3.5" /> {metrics.total_sent} enviados</span>
            <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {metrics.open_rate.toFixed(1)}% abertura</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {metrics.click_rate.toFixed(1)}% cliques</span>
            {metrics.total_bounced > 0 && (
                <span className="flex items-center gap-1 text-red-500"><XCircle className="w-3.5 h-3.5" /> {metrics.total_bounced} bounce</span>
            )}
        </div>
    );
}

// ── Segment Builder ──────────────────────────────────────
function SegmentBuilder({
    filters,
    onChange,
}: {
    filters: SegmentFilters;
    onChange: (f: SegmentFilters) => void;
}) {
    const { data: preview, isLoading } = useSegmentPreview(filters);

    const LIFECYCLE_OPTIONS = [
        { value: 'LEAD', label: 'Lead' },
        { value: 'QUALIFIED', label: 'Qualificado' },
        { value: 'PROPOSAL', label: 'Proposta' },
        { value: 'CUSTOMER', label: 'Cliente' },
        { value: 'INACTIVE', label: 'Inativo' },
    ];

    const toggleLifecycle = (stage: string) => {
        const current = filters.lifecycle_stage ?? [];
        const next = current.includes(stage)
            ? current.filter(s => s !== stage)
            : [...current, stage];
        onChange({ ...filters, lifecycle_stage: next });
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Estágio no Funil
                </label>
                <div className="flex flex-wrap gap-2">
                    {LIFECYCLE_OPTIONS.map(opt => {
                        const active = (filters.lifecycle_stage ?? []).includes(opt.value);
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => toggleLifecycle(opt.value)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                                    active
                                        ? 'bg-primary-500 text-white border-primary-500'
                                        : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                                }`}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                    {(filters.lifecycle_stage?.length ?? 0) > 0 && (
                        <button
                            type="button"
                            onClick={() => onChange({ ...filters, lifecycle_stage: [] })}
                            className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            Limpar
                        </button>
                    )}
                </div>
            </div>

            {/* Preview de destinatários */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                    <Users className="w-4 h-4 text-primary-500" />
                )}
                <div>
                    <span className="text-sm font-semibold text-slate-800 dark:text-white">
                        {isLoading ? '...' : preview?.count ?? 0} destinatários
                    </span>
                    {preview?.sample && preview.sample.length > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">
                            Ex: {preview.sample.slice(0, 3).map(s => s.name).join(', ')}
                            {preview.count > 3 ? ` e mais ${preview.count - 3}` : ''}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Modal: Nova Campanha ──────────────────────────────────
function NewCampaignModal({
    templates,
    onClose,
}: {
    templates: EmailTemplate[];
    onClose: () => void;
}) {
    const [name, setName] = useState('');
    const [templateId, setTemplateId] = useState('');
    const [filters, setFilters] = useState<SegmentFilters>({});
    const create = useCreateCampaign();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        await create.mutateAsync({
            name: name.trim(),
            template_id: templateId || undefined,
            segment_filters: filters,
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-5">Nova Campanha</h2>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            Nome da Campanha
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ex: Reativação Q1 2026"
                            required
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            Template de Email
                        </label>
                        <select
                            value={templateId}
                            onChange={e => setTemplateId(e.target.value)}
                            aria-label="Selecionar template"
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="">Selecionar depois</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Segmentação
                        </label>
                        <SegmentBuilder filters={filters} onChange={setFilters} />
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={create.isPending || !name.trim()}
                            className="px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                        >
                            {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Criar Campanha
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Modal: Gerar Template com IA ──────────────────────────
function AITemplateModal({ onClose }: { onClose: () => void }) {
    const [objective, setObjective] = useState('');
    const [targetSegment, setTargetSegment] = useState('');
    const [tone, setTone] = useState('profissional');
    const [result, setResult] = useState<{ template: EmailTemplate; subject_variants: string[] } | null>(null);
    const generate = useGenerateEmailTemplate();

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await generate.mutateAsync({ objective, targetSegment, tone });
        setResult(res);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center gap-2 mb-5">
                    <Sparkles className="w-5 h-5 text-primary-500" />
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Gerar Template com IA</h2>
                </div>

                {!result ? (
                    <form onSubmit={handleGenerate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                Objetivo do Email *
                            </label>
                            <input
                                type="text"
                                value={objective}
                                onChange={e => setObjective(e.target.value)}
                                placeholder="Ex: Reativar clientes inativos há 60 dias"
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                Público-alvo
                            </label>
                            <input
                                type="text"
                                value={targetSegment}
                                onChange={e => setTargetSegment(e.target.value)}
                                placeholder="Ex: Empresas B2B de médio porte, decisores de compras"
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                Tom
                            </label>
                            <select
                                value={tone}
                                onChange={e => setTone(e.target.value)}
                                aria-label="Selecionar tom"
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="profissional">Profissional</option>
                                <option value="informal">Informal / Amigável</option>
                                <option value="urgente">Urgente / Oferta</option>
                                <option value="consultivo">Consultivo</option>
                            </select>
                        </div>
                        <div className="flex gap-3 justify-end pt-2">
                            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">Cancelar</button>
                            <button
                                type="submit"
                                disabled={generate.isPending || !objective.trim()}
                                className="px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                            >
                                {generate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {generate.isPending ? 'Gerando...' : 'Gerar com IA'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-200 dark:border-green-500/20">
                            <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-1">Template criado com sucesso!</p>
                            <p className="text-sm text-green-600 dark:text-green-300">"{result.template.name}" está disponível na lista de templates.</p>
                        </div>
                        {result.subject_variants.length > 0 && (
                            <div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Variações de assunto geradas:</p>
                                <ul className="space-y-1">
                                    {result.subject_variants.map((v, i) => (
                                        <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                                            <span className="text-primary-500 font-bold">{i + 1}.</span> {v}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                        >
                            Fechar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Campaign Card ────────────────────────────────────────
function CampaignCard({ campaign, onSend, onDelete }: {
    campaign: EmailCampaign;
    onSend: (id: string) => void;
    onDelete: (id: string) => void;
}) {
    const metrics = computeMetrics(campaign);
    const canSend = ['draft', 'paused'].includes(campaign.status) && !!campaign.template_id;
    const [confirmDelete, setConfirmDelete] = useState(false);

    return (
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-5 hover:border-slate-300 dark:hover:border-white/20 transition-colors">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{campaign.name}</h3>
                        <StatusBadge status={campaign.status} />
                    </div>
                    {campaign.template && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                            <FileText className="w-3 h-3" /> {campaign.template.name}
                        </p>
                    )}
                    {campaign.status === 'sent' && <MetricsRow metrics={metrics} />}
                    {campaign.status !== 'sent' && campaign.estimated_recipients > 0 && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <Users className="w-3 h-3" /> {campaign.estimated_recipients} destinatários estimados
                        </p>
                    )}
                    {campaign.scheduled_at && campaign.status === 'scheduled' && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Agendada para {new Date(campaign.scheduled_at).toLocaleString('pt-BR')}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {canSend && (
                        <button
                            onClick={() => onSend(campaign.id)}
                            title="Disparar campanha"
                            className="p-2 rounded-lg bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-500/20 transition-colors"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    )}
                    {confirmDelete ? (
                        <div className="flex items-center gap-1">
                            <button onClick={() => onDelete(campaign.id)} className="text-xs text-red-600 dark:text-red-400 font-medium px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">Confirmar</button>
                            <button onClick={() => setConfirmDelete(false)} className="text-xs text-slate-500 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5">Cancelar</button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setConfirmDelete(true)}
                            title="Excluir campanha"
                            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Template Card ────────────────────────────────────────
function TemplateCard({ template, onDelete }: { template: EmailTemplate; onDelete: (id: string) => void }) {
    const [confirmDelete, setConfirmDelete] = useState(false);

    return (
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 hover:border-slate-300 dark:hover:border-white/20 transition-colors">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{template.name}</p>
                        {template.ai_generated && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-medium">
                                <Sparkles className="w-3 h-3" /> IA
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">Assunto: {template.subject}</p>
                </div>
                {confirmDelete ? (
                    <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => onDelete(template.id)} className="text-xs text-red-600 dark:text-red-400 font-medium px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">Excluir</button>
                        <button onClick={() => setConfirmDelete(false)} className="text-xs text-slate-500 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5">Cancelar</button>
                    </div>
                ) : (
                    <button
                        onClick={() => setConfirmDelete(true)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Main: CampaignsManager ────────────────────────────────
type Tab = 'campaigns' | 'templates';

export function CampaignsManager() {
    const [tab, setTab] = useState<Tab>('campaigns');
    const [showNewCampaign, setShowNewCampaign] = useState(false);
    const [showAITemplate, setShowAITemplate] = useState(false);
    const [sendResult, setSendResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

    const { data: campaigns = [], isLoading: loadingCampaigns } = useCampaigns();
    const { data: templates = [], isLoading: loadingTemplates } = useEmailTemplates();
    const deleteCampaign = useDeleteCampaign();
    const sendCampaign = useSendCampaign();
    const deleteTemplate = useDeleteEmailTemplate();

    const handleSend = async (campaignId: string) => {
        try {
            const result = await sendCampaign.mutateAsync(campaignId);
            setSendResult(result);
        } catch (err: any) {
            alert(`Erro ao enviar campanha: ${err.message}`);
        }
    };

    const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
        { id: 'campaigns', label: 'Campanhas', icon: Mail },
        { id: 'templates', label: 'Templates', icon: FileText },
    ];

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Mail className="w-5 h-5 text-primary-500" />
                        Campanhas de Email
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Crie e dispare campanhas segmentadas para seus contatos.
                    </p>
                </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-white/10">
                {TABS.map(t => {
                    const active = tab === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                                active
                                    ? 'text-primary-600 dark:text-primary-400'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <t.icon className="w-4 h-4" />
                            {t.label}
                            {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400 rounded-full" />}
                        </button>
                    );
                })}
            </div>

            {/* Send Result Banner */}
            {sendResult && (
                <div className="mb-4 p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl flex items-center justify-between">
                    <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                        ✅ Campanha enviada: {sendResult.sent} emails enviados
                        {sendResult.failed > 0 && `, ${sendResult.failed} falhas`}
                    </p>
                    <button onClick={() => setSendResult(null)} className="text-xs text-green-600 dark:text-green-400 hover:underline">Fechar</button>
                </div>
            )}

            {/* Tab: Campanhas */}
            {tab === 'campaigns' && (
                <div>
                    <div className="flex justify-end mb-4">
                        <button
                            onClick={() => setShowNewCampaign(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium transition-colors"
                        >
                            <Plus className="w-4 h-4" /> Nova Campanha
                        </button>
                    </div>

                    {loadingCampaigns ? (
                        <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
                        </div>
                    ) : campaigns.length === 0 ? (
                        <div className="py-16 text-center">
                            <Mail className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Nenhuma campanha criada ainda.</p>
                            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Crie sua primeira campanha para começar a nutrir seus contatos.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {campaigns.map(campaign => (
                                <CampaignCard
                                    key={campaign.id}
                                    campaign={campaign}
                                    onSend={handleSend}
                                    onDelete={id => deleteCampaign.mutate(id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Tab: Templates */}
            {tab === 'templates' && (
                <div>
                    <div className="flex justify-end gap-2 mb-4">
                        <button
                            onClick={() => setShowAITemplate(true)}
                            className="flex items-center gap-2 px-4 py-2 border border-primary-300 dark:border-primary-500/30 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-xl text-sm font-medium transition-colors"
                        >
                            <Sparkles className="w-4 h-4" /> Gerar com IA
                        </button>
                    </div>

                    {loadingTemplates ? (
                        <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="py-16 text-center">
                            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Nenhum template criado ainda.</p>
                            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Use a IA para gerar um template em segundos.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {templates.map(template => (
                                <TemplateCard
                                    key={template.id}
                                    template={template}
                                    onDelete={id => deleteTemplate.mutate(id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modais */}
            {showNewCampaign && (
                <NewCampaignModal
                    templates={templates}
                    onClose={() => setShowNewCampaign(false)}
                />
            )}
            {showAITemplate && (
                <AITemplateModal onClose={() => setShowAITemplate(false)} />
            )}
        </div>
    );
}

export default CampaignsManager;
