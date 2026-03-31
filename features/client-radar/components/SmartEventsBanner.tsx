'use client';

/**
 * SmartEventsBanner — Banner inteligente no topo do Dashboard
 *
 * Exibe alertas de aniversários (hoje e próximos 7 dias),
 * datas comemorativas próximas e destaque de clientes VIP.
 * Clicável: abre o Radar de Clientes completo.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Gift, Star, Calendar, ChevronRight, X, Send,
    Crown, Heart, Cake, Sparkles,
} from 'lucide-react';
import { useRadarSummary, useSendEventMessage } from '../hooks/useClientRadar';
import type { BirthdayContact, CommemorativeDate } from '@/lib/supabase/client-radar';

// ── Sub-component: Avatar ──────────────────────────────────────────────────
function ContactAvatar({ name, avatar, size = 'sm' }: { name: string; avatar?: string | null; size?: 'sm' | 'md' }) {
    const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
    if (avatar) {
        return <img src={avatar} alt={name} className={`${sz} rounded-full object-cover flex-shrink-0`} />;
    }
    return (
        <div className={`${sz} rounded-full bg-gradient-to-br from-violet-400 to-emerald-400 flex items-center justify-center text-white font-bold flex-shrink-0`}>
            {initials}
        </div>
    );
}

// ── Sub-component: Birthday Pill ───────────────────────────────────────────
function BirthdayPill({
    contact,
    onSend,
    loading,
}: {
    contact: BirthdayContact;
    onSend: (c: BirthdayContact) => void;
    loading: boolean;
}) {
    const isToday = contact.days_until_birthday === 0;
    const firstName = contact.name.split(' ')[0];

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium flex-shrink-0 ${isToday
            ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300'
            : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
            }`}>
            <ContactAvatar name={contact.name} avatar={contact.avatar} />
            <span>
                {firstName}
                {isToday
                    ? ' 🎂 hoje!'
                    : ` — ${contact.days_until_birthday}d`}
            </span>
            <button
                onClick={() => onSend(contact)}
                disabled={loading}
                title="Enviar parabéns"
                className="ml-1 p-0.5 rounded-full hover:bg-white/30 transition-colors disabled:opacity-40"
            >
                <Send size={11} />
            </button>
        </div>
    );
}

// ── Sub-component: Commemorative Date Pill ────────────────────────────────
function DatePill({ date }: { date: CommemorativeDate }) {
    return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 text-xs font-medium text-violet-700 dark:text-violet-300 flex-shrink-0">
            <span>{date.emoji}</span>
            <span>{date.name}</span>
            <span className="opacity-60">
                {date.daysUntil === 0 ? 'hoje' : `em ${date.daysUntil}d`}
            </span>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────
export const SmartEventsBanner: React.FC = () => {
    const router = useRouter();
    const { data: radar, isLoading } = useRadarSummary();
    const sendMessage = useSendEventMessage();
    const [dismissed, setDismissed] = useState(false);
    const [sendingId, setSendingId] = useState<string | null>(null);

    if (dismissed || isLoading || !radar) return null;

    const todayCount = radar.todayBirthdays.length;
    const upcomingCount = radar.upcomingBirthdays.length;
    const immDates = radar.upcomingDates.filter(d => d.daysUntil <= 7);

    // Não exibir se não há nada relevante
    if (todayCount === 0 && upcomingCount === 0 && immDates.length === 0) return null;

    const handleSend = async (contact: BirthdayContact) => {
        setSendingId(contact.id);
        try {
            await sendMessage.mutateAsync({
                contactId: contact.id,
                eventType: 'birthday',
            });
        } finally {
            setSendingId(null);
        }
    };

    const allBirthdays = [
        ...radar.todayBirthdays,
        ...radar.upcomingBirthdays,
    ];

    return (
        <div className="relative w-full rounded-2xl overflow-hidden border border-amber-200 dark:border-amber-500/20 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 dark:from-amber-500/10 dark:via-orange-500/10 dark:to-rose-500/10 mb-4">
            {/* Dismiss button */}
            <button
                onClick={() => setDismissed(true)}
                className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-white/30 transition-colors z-10"
                title="Fechar"
            >
                <X size={14} />
            </button>

            <div className="px-4 py-3">
                {/* Header row */}
                <div className="flex items-center gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                        {todayCount > 0 && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold animate-pulse">
                                <Cake size={10} />
                                {todayCount} hoje!
                            </span>
                        )}
                        <span className="text-sm font-semibold text-slate-700 dark:text-white flex items-center gap-1.5">
                            <Sparkles size={14} className="text-amber-500" />
                            Radar de Clientes
                        </span>
                        {upcomingCount > 0 && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                +{upcomingCount} aniversários em 7 dias
                            </span>
                        )}
                        {immDates.length > 0 && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                · {immDates.length} data{immDates.length > 1 ? 's' : ''} comemorativa{immDates.length > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    <button
                        onClick={() => router.push('/radar')}
                        className="ml-auto flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium hover:underline flex-shrink-0 mr-6"
                    >
                        Ver tudo <ChevronRight size={12} />
                    </button>
                </div>

                {/* Pills scroll row */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {/* Birthday pills */}
                    {allBirthdays.slice(0, 8).map(c => (
                        <BirthdayPill
                            key={c.id}
                            contact={c}
                            onSend={handleSend}
                            loading={sendingId === c.id}
                        />
                    ))}

                    {/* Divider */}
                    {allBirthdays.length > 0 && immDates.length > 0 && (
                        <div className="w-px h-5 bg-slate-300 dark:bg-white/20 flex-shrink-0" />
                    )}

                    {/* Commemorative date pills */}
                    {immDates.slice(0, 3).map(d => (
                        <DatePill key={d.id + d.date} date={d} />
                    ))}

                    {/* VIP highlight */}
                    {radar.vipClients.length > 0 && (
                        <>
                            <div className="w-px h-5 bg-slate-300 dark:bg-white/20 flex-shrink-0" />
                            <button
                                onClick={() => router.push('/radar?tab=vip')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-yellow-300 dark:border-yellow-500/30 bg-yellow-50 dark:bg-yellow-500/10 text-xs font-medium text-yellow-700 dark:text-yellow-300 flex-shrink-0 hover:opacity-80 transition-opacity"
                            >
                                <Crown size={11} />
                                {radar.vipClients.length} cliente{radar.vipClients.length > 1 ? 's' : ''} VIP
                                <ChevronRight size={10} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
