'use client';

/**
 * ClientRadarPage — Radar de Clientes
 *
 * Página completa de inteligência de clientes:
 * - Aniversários (calendário dos próximos 30 dias)
 * - Clientes VIP (por faturamento e visitas)
 * - Datas Comemorativas (próximos 90 dias)
 * - Configuração de eventos automáticos
 */

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Cake, Crown, Calendar, Gift, Settings, Send, ChevronRight,
    Users, TrendingUp, Star, Sparkles, Bell, Check, AlertTriangle,
    Heart, Flower, Target,
} from 'lucide-react';
import {
    useUpcomingBirthdays,
    useVIPClients,
    useCommemorativeDates,
    useEventRules,
    useUpsertEventRule,
    useSendEventMessage,
} from './hooks/useClientRadar';
import { ClientRadarActionModal } from './components/ClientRadarActionModal';
import {
    DEFAULT_MESSAGE_TEMPLATES,
    type BirthdayContact,
    type VIPClient,
    type CommemorativeDate,
    type EventType,
    type ClientEventRule,
} from '@/lib/supabase/client-radar';

type TabId = 'birthdays' | 'vip' | 'dates' | 'settings';

// ── Helpers ────────────────────────────────────────────────────────────────
function ContactAvatar({ name, avatar }: { name: string; avatar?: string | null }) {
    const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    if (avatar) return <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />;
    return (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-emerald-400 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {initials}
        </div>
    );
}

function formatCurrency(value: number) {
    return `R$ ${(value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

// ── Tab: Aniversários ─────────────────────────────────────────────────────
function BirthdaysTab() {
    const { data, isLoading } = useUpcomingBirthdays(30);
    const [modalContact, setModalContact] = useState<BirthdayContact | null>(null);
    const sendMessage = useSendEventMessage();

    const birthdays = data?.birthdays ?? [];
    const today = birthdays.filter(b => b.days_until_birthday === 0);
    const thisWeek = birthdays.filter(b => b.days_until_birthday > 0 && b.days_until_birthday <= 7);
    const thisMonth = birthdays.filter(b => b.days_until_birthday > 7);

    const sections = [
        { label: '🎂 Hoje', items: today, urgency: 'today' as const },
        { label: '📅 Esta semana', items: thisWeek, urgency: 'week' as const },
        { label: '📆 Este mês', items: thisMonth, urgency: 'month' as const },
    ].filter(s => s.items.length > 0);

    if (isLoading) return <LoadingState />;
    if (birthdays.length === 0) return (
        <EmptyState
            icon={Cake}
            title="Nenhum aniversário próximo"
            description="Adicione a data de nascimento dos seus contatos para ver seus aniversários aqui."
        />
    );

    return (
        <>
            {sections.map(section => (
                <div key={section.label} className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {section.label}
                        </h2>
                        <span className="text-xs bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                            {section.items.length}
                        </span>
                    </div>
                    <div className="space-y-2">
                        {section.items.map(c => (
                            <div
                                key={c.id}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${section.urgency === 'today'
                                    ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10'
                                    : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-slate-300'
                                    }`}
                            >
                                <ContactAvatar name={c.name} avatar={c.avatar} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{c.name}</p>
                                        {section.urgency === 'today' && (
                                            <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse flex-shrink-0">
                                                HOJE!
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Completa {c.turning_age} anos
                                            {section.urgency !== 'today' && ` — em ${c.days_until_birthday} dia${c.days_until_birthday > 1 ? 's' : ''}`}
                                        </p>
                                        {c.phone && (
                                            <p className="text-xs text-slate-400 truncate">{c.phone}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {c.total_value > 0 && (
                                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                            {formatCurrency(c.total_value)}
                                        </span>
                                    )}
                                    <button
                                        onClick={() => setModalContact(c)}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors"
                                    >
                                        <Send size={11} /> Parabéns
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {modalContact && (
                <ClientRadarActionModal
                    contact={modalContact}
                    eventType="birthday"
                    onClose={() => setModalContact(null)}
                />
            )}
        </>
    );
}

// ── Tab: Clientes VIP ─────────────────────────────────────────────────────
function VIPTab() {
    const { data, isLoading } = useVIPClients(30);
    const [modalContact, setModalContact] = useState<VIPClient | null>(null);
    const [sortBy, setSortBy] = useState<'revenue' | 'visits' | 'score'>('score');

    const clients = [...(data?.vipClients ?? [])].sort((a, b) => {
        if (sortBy === 'revenue') return b.won_deals_value - a.won_deals_value;
        if (sortBy === 'visits') return b.activities_count - a.activities_count;
        return b.vip_score - a.vip_score;
    });

    if (isLoading) return <LoadingState />;
    if (clients.length === 0) return (
        <EmptyState
            icon={Crown}
            title="Nenhum cliente VIP ainda"
            description="Clientes com deals ganhos e atividades concluídas aparecem aqui automaticamente."
        />
    );

    return (
        <>
            {/* Sort controls */}
            <div className="flex items-center gap-2 mb-5">
                <span className="text-xs text-slate-500">Ordenar por:</span>
                {([
                    { id: 'score', label: 'Score VIP' },
                    { id: 'revenue', label: 'Faturamento' },
                    { id: 'visits', label: 'Atividades' },
                ] as const).map(opt => (
                    <button
                        key={opt.id}
                        onClick={() => setSortBy(opt.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${sortBy === opt.id
                            ? 'bg-yellow-500 text-white border-yellow-500'
                            : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-yellow-400'
                            }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            <div className="space-y-2">
                {clients.map((c, idx) => (
                    <div
                        key={c.id}
                        className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-yellow-300 dark:hover:border-yellow-500/30 transition-all"
                    >
                        {/* Rank */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${idx === 0 ? 'bg-yellow-400 text-white' : idx === 1 ? 'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-300' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500'}`}>
                            {idx + 1}
                        </div>

                        <ContactAvatar name={c.name} avatar={c.avatar} />

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{c.name}</p>
                                {idx < 3 && <Crown size={12} className="text-yellow-500 flex-shrink-0" />}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <TrendingUp size={10} /> {c.won_deals_count} deals ganhos
                                </span>
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Target size={10} /> {c.activities_count} atividades
                                </span>
                            </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                {c.won_deals_value > 0 ? formatCurrency(c.won_deals_value) : '—'}
                            </p>
                            <p className="text-[10px] text-slate-400">Score: {Math.round(c.vip_score)}</p>
                        </div>

                        <button
                            onClick={() => setModalContact(c)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-yellow-500 text-white font-medium hover:bg-yellow-600 transition-colors flex-shrink-0"
                        >
                            <Gift size={11} /> Recompensar
                        </button>
                    </div>
                ))}
            </div>

            {modalContact && (
                <ClientRadarActionModal
                    contact={modalContact}
                    eventType="customer_day"
                    onClose={() => setModalContact(null)}
                />
            )}
        </>
    );
}

// ── Tab: Datas Comemorativas ───────────────────────────────────────────────
function DatesTab() {
    const { data, isLoading } = useCommemorativeDates();
    const [modalDate, setModalDate] = useState<CommemorativeDate | null>(null);
    const [selectedDate, setSelectedDate] = useState<CommemorativeDate | null>(null);

    const dates = data?.dates ?? [];

    if (isLoading) return <LoadingState />;

    return (
        <div className="space-y-4">
            {dates.map(d => {
                const isUrgent = d.daysUntil <= 3;
                const isToday = d.daysUntil === 0;

                return (
                    <div
                        key={d.id + d.date}
                        className={`p-4 rounded-xl border transition-all ${isToday
                            ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10'
                            : isUrgent
                                ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10'
                                : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5'
                            }`}
                    >
                        <div className="flex items-start gap-4">
                            <span className="text-3xl">{d.emoji}</span>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-sm font-semibold text-slate-800 dark:text-white">{d.name}</h3>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isToday
                                        ? 'bg-amber-500 text-white'
                                        : isUrgent
                                            ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
                                            : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                                        }`}>
                                        {isToday ? 'HOJE!' : d.daysUntil === 1 ? 'Amanhã' : `em ${d.daysUntil} dias`}
                                    </span>
                                    {d.targetGender && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300">
                                            {d.targetGender === 'feminino' ? '👩 Mulheres' : '👨 Homens'}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{d.description}</p>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setSelectedDate(d)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors"
                                    >
                                        <Send size={11} />
                                        Enviar campanha
                                    </button>
                                    <span className="text-xs text-slate-400">
                                        {d.date}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}

            {selectedDate && (
                <CommemorativeCampaignModal date={selectedDate} onClose={() => setSelectedDate(null)} />
            )}
        </div>
    );
}

// ── Modal de campanha comemorativa ────────────────────────────────────────
function CommemorativeCampaignModal({ date, onClose }: { date: CommemorativeDate; onClose: () => void }) {
    const sendMessage = useSendEventMessage();
    const [message, setMessage] = useState(DEFAULT_MESSAGE_TEMPLATES[date.id as EventType] ?? '');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center gap-3 p-5 border-b border-slate-200 dark:border-white/10">
                    <span className="text-3xl">{date.emoji}</span>
                    <div className="flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white">{date.name}</p>
                        <p className="text-xs text-slate-400">{date.targetGender ? `Para clientes ${date.targetGender === 'feminino' ? 'mulheres' : 'homens'}` : 'Para todos os clientes'}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                        <span className="text-xl">×</span>
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">
                            Template de mensagem
                        </label>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            rows={5}
                            className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                            Use {'{{contact.first_name}}'} e {'{{org.name}}'}
                        </p>
                    </div>

                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                            💡 A mensagem será enviada para todos os contatos
                            {date.targetGender ? ` do gênero ${date.targetGender}` : ''}
                            {' '}via <strong>Email Campaigns</strong>. Configure em Configurações → Campanhas.
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                            Cancelar
                        </button>
                        <button
                            onClick={() => window.open('/settings?tab=campaigns', '_blank')}
                            className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <ChevronRight size={14} /> Ir para Campanhas
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Tab: Configurações ────────────────────────────────────────────────────
function SettingsTab() {
    const { data, isLoading } = useEventRules();
    const upsert = useUpsertEventRule();

    const rules = data?.rules ?? [];

    const EVENT_CONFIGS: Array<{
        type: EventType;
        label: string;
        emoji: string;
        description: string;
    }> = [
        { type: 'birthday', label: 'Aniversário', emoji: '🎂', description: 'Mensagem automática de parabéns no dia do aniversário' },
        { type: 'womens_day', label: 'Dia da Mulher', emoji: '💜', description: 'Para clientes do gênero feminino — 8 de março' },
        { type: 'mothers_day', label: 'Dia das Mães', emoji: '🌸', description: 'Para clientes do gênero feminino — 2º domingo de maio' },
        { type: 'fathers_day', label: 'Dia dos Pais', emoji: '👨‍👧', description: 'Para clientes do gênero masculino — 2º domingo de agosto' },
        { type: 'customer_day', label: 'Dia do Cliente', emoji: '🤝', description: 'Para todos os clientes — 15 de setembro' },
        { type: 'christmas', label: 'Natal', emoji: '🎄', description: 'Para todos os clientes — 25 de dezembro' },
        { type: 'new_year', label: 'Ano Novo', emoji: '🎆', description: 'Para todos os clientes — 1 de janeiro' },
    ];

    if (isLoading) return <LoadingState />;

    return (
        <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 mb-6">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-800 dark:text-white">Automação de mensagens:</strong> Configure quais eventos disparam mensagens automáticas via NossoAgent para seus clientes. O agente deve estar ativo e configurado.
                </p>
            </div>

            {EVENT_CONFIGS.map(ev => {
                const rule = rules.find(r => r.event_type === ev.type);
                const isEnabled = rule?.is_enabled ?? false;

                return (
                    <div
                        key={ev.type}
                        className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5"
                    >
                        <span className="text-2xl">{ev.emoji}</span>
                        <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-semibold text-slate-800 dark:text-white">{ev.label}</p>

                                {/* Toggle */}
                                <button
                                    onClick={() => upsert.mutate({
                                        event_type: ev.type,
                                        is_enabled: !isEnabled,
                                        send_days_before: rule?.send_days_before ?? 0,
                                        send_time: rule?.send_time ?? '09:00:00',
                                        message_template: rule?.message_template ?? DEFAULT_MESSAGE_TEMPLATES[ev.type],
                                        target_gender: rule?.target_gender ?? null,
                                        channel: rule?.channel ?? 'whatsapp',
                                    })}
                                    disabled={upsert.isPending}
                                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${isEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/20'}`}
                                >
                                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{ev.description}</p>
                            {isEnabled && (
                                <div className="flex items-center gap-3 mt-2 flex-wrap">
                                    <select
                                        value={rule?.send_days_before ?? 0}
                                        onChange={e => upsert.mutate({
                                            event_type: ev.type,
                                            is_enabled: true,
                                            send_days_before: parseInt(e.target.value),
                                            send_time: rule?.send_time ?? '09:00:00',
                                            message_template: rule?.message_template ?? DEFAULT_MESSAGE_TEMPLATES[ev.type],
                                            target_gender: rule?.target_gender ?? null,
                                            channel: rule?.channel ?? 'whatsapp',
                                        })}
                                        className="text-xs border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 bg-white dark:bg-white/5 text-slate-700 dark:text-white"
                                    >
                                        <option value={0}>No dia</option>
                                        <option value={1}>1 dia antes</option>
                                        <option value={3}>3 dias antes</option>
                                        <option value={7}>1 semana antes</option>
                                    </select>
                                    <select
                                        value={rule?.channel ?? 'whatsapp'}
                                        onChange={e => upsert.mutate({
                                            event_type: ev.type,
                                            is_enabled: true,
                                            send_days_before: rule?.send_days_before ?? 0,
                                            send_time: rule?.send_time ?? '09:00:00',
                                            message_template: rule?.message_template ?? DEFAULT_MESSAGE_TEMPLATES[ev.type],
                                            target_gender: rule?.target_gender ?? null,
                                            channel: e.target.value as 'whatsapp' | 'email' | 'both',
                                        })}
                                        className="text-xs border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 bg-white dark:bg-white/5 text-slate-700 dark:text-white"
                                    >
                                        <option value="whatsapp">WhatsApp</option>
                                        <option value="email">Email</option>
                                        <option value="both">Ambos</option>
                                    </select>
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                        <Check size={10} /> Ativo
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Loading & Empty States ─────────────────────────────────────────────────
function LoadingState() {
    return (
        <div className="space-y-3">
            {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse" />
            ))}
        </div>
    );
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4">
                <Icon size={28} className="text-slate-400" />
            </div>
            <p className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">{title}</p>
            <p className="text-sm text-slate-400 max-w-xs">{description}</p>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────
const TABS: Array<{ id: TabId; label: string; icon: React.ElementType; badge?: string }> = [
    { id: 'birthdays', label: 'Aniversários', icon: Cake },
    { id: 'vip', label: 'Clientes VIP', icon: Crown },
    { id: 'dates', label: 'Datas Comemorativas', icon: Calendar },
    { id: 'settings', label: 'Automação', icon: Settings },
];

const ClientRadarPage: React.FC = () => {
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<TabId>(
        (searchParams.get('tab') as TabId) ?? 'birthdays'
    );

    const { data: summary } = useUpcomingBirthdays(7);
    const todayCount = summary?.birthdays.filter(b => b.days_until_birthday === 0).length ?? 0;
    const weekCount = summary?.birthdays.filter(b => b.days_until_birthday > 0).length ?? 0;

    return (
        <div className="flex flex-col h-[calc(100vh-7rem)]">
            {/* Page header */}
            <div className="flex items-center justify-between mb-6 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display tracking-tight flex items-center gap-2">
                        <Sparkles className="text-amber-500" size={28} />
                        Radar de Clientes
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Inteligência de clientes — aniversários, VIPs e datas especiais.
                    </p>
                </div>

                {/* Quick stats */}
                <div className="hidden md:flex items-center gap-3">
                    {todayCount > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                            <Cake size={16} className="text-amber-500" />
                            <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                                {todayCount} aniversário{todayCount > 1 ? 's' : ''} hoje!
                            </span>
                        </div>
                    )}
                    {weekCount > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                            <Calendar size={16} className="text-slate-500" />
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                                +{weekCount} esta semana
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-6 shrink-0 border-b border-slate-200 dark:border-white/10">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${activeTab === tab.id
                            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <tab.icon size={15} />
                        {tab.label}
                        {tab.id === 'birthdays' && todayCount > 0 && (
                            <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                                {todayCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'birthdays' && <BirthdaysTab />}
                {activeTab === 'vip' && <VIPTab />}
                {activeTab === 'dates' && <DatesTab />}
                {activeTab === 'settings' && <SettingsTab />}
            </div>
        </div>
    );
};

export default ClientRadarPage;
