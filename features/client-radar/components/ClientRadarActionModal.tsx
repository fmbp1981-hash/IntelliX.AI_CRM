'use client';

/**
 * ClientRadarActionModal — Modal de ação sobre um cliente do Radar
 *
 * Permite: enviar mensagem personalizada, visualizar histórico,
 * adicionar nota, criar tarefa de follow-up ou dar desconto.
 */

import React, { useState } from 'react';
import {
    X, Send, MessageCircle, Star, Gift, FileText, CheckSquare,
    Phone, Mail, Crown, Cake,
} from 'lucide-react';
import { useSendEventMessage } from '../hooks/useClientRadar';
import {
    DEFAULT_MESSAGE_TEMPLATES,
    interpolateTemplate,
    type EventType,
    type BirthdayContact,
    type VIPClient,
} from '@/lib/supabase/client-radar';

type ContactBase = {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    avatar: string | null;
    total_value?: number;
};

interface Props {
    contact: ContactBase & Partial<BirthdayContact> & Partial<VIPClient>;
    eventType?: EventType;
    onClose: () => void;
}

export const ClientRadarActionModal: React.FC<Props> = ({ contact, eventType = 'birthday', onClose }) => {
    const sendMessage = useSendEventMessage();
    const [tab, setTab] = useState<'message' | 'actions'>('message');
    const [messageText, setMessageText] = useState(
        interpolateTemplate(
            DEFAULT_MESSAGE_TEMPLATES[eventType] ?? '',
            { name: contact.name }
        )
    );
    const [selectedChannel, setSelectedChannel] = useState<'whatsapp' | 'email'>('whatsapp');
    const [sending, setSending] = useState(false);

    const firstName = contact.name.split(' ')[0];

    const handleSend = async () => {
        setSending(true);
        try {
            await sendMessage.mutateAsync({
                contactId: contact.id,
                eventType,
                messageOverride: messageText,
                channel: selectedChannel,
            });
            onClose();
        } finally {
            setSending(false);
        }
    };

    const EVENT_LABELS: Record<EventType, string> = {
        birthday: '🎂 Aniversário',
        womens_day: '💜 Dia da Mulher',
        mothers_day: '🌸 Dia das Mães',
        fathers_day: '👨‍👧 Dia dos Pais',
        valentines_day: '❤️ Dia dos Namorados',
        christmas: '🎄 Natal',
        new_year: '🎆 Ano Novo',
        customer_day: '🤝 Dia do Cliente',
        custom: '✉️ Mensagem',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">

                {/* Header */}
                <div className="flex items-center gap-3 p-5 border-b border-slate-200 dark:border-white/10">
                    {contact.avatar ? (
                        <img src={contact.avatar} alt={contact.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-emerald-400 flex items-center justify-center text-white font-bold">
                            {contact.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                        </div>
                    )}
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900 dark:text-white">{contact.name}</p>
                            {(contact as VIPClient).vip_score !== undefined && (
                                <span className="flex items-center gap-0.5 text-[10px] bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded-full font-medium">
                                    <Crown size={9} /> VIP
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{EVENT_LABELS[eventType]}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                        <X size={18} />
                    </button>
                </div>

                {/* Contact info bar */}
                <div className="flex items-center gap-4 px-5 py-2.5 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                    {contact.phone && (
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Phone size={12} /> {contact.phone}
                        </span>
                    )}
                    {contact.email && (
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Mail size={12} /> {contact.email}
                        </span>
                    )}
                    {(contact.total_value ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium ml-auto">
                            <Star size={11} />
                            R$ {((contact.total_value ?? 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-white/10">
                    {[
                        { id: 'message', label: 'Mensagem', icon: MessageCircle },
                        { id: 'actions', label: 'Ações', icon: CheckSquare },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id as typeof tab)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id
                                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <t.icon size={14} /> {t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-5">
                    {tab === 'message' && (
                        <div className="space-y-4">
                            {/* Channel selector */}
                            <div className="flex gap-2">
                                {(['whatsapp', 'email'] as const).map(ch => (
                                    <button
                                        key={ch}
                                        onClick={() => setSelectedChannel(ch)}
                                        disabled={ch === 'email' && !contact.email}
                                        className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${selectedChannel === ch
                                            ? 'bg-emerald-500 text-white border-emerald-500'
                                            : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-emerald-400'
                                            }`}
                                    >
                                        {ch === 'whatsapp' ? '📱 WhatsApp' : '📧 Email'}
                                    </button>
                                ))}
                            </div>

                            {/* Message editor */}
                            <div>
                                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">
                                    Mensagem para {firstName}
                                </label>
                                <textarea
                                    value={messageText}
                                    onChange={e => setMessageText(e.target.value)}
                                    rows={5}
                                    className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Variáveis: {'{{contact.name}}'}, {'{{contact.first_name}}'}
                                </p>
                            </div>

                            <button
                                onClick={handleSend}
                                disabled={sending || !messageText.trim()}
                                className="w-full py-3 rounded-xl bg-emerald-500 text-white font-medium flex items-center justify-center gap-2 hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                            >
                                <Send size={15} />
                                {sending ? 'Enviando...' : `Enviar via ${selectedChannel === 'whatsapp' ? 'WhatsApp' : 'Email'}`}
                            </button>
                        </div>
                    )}

                    {tab === 'actions' && (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                Ações rápidas para {firstName}
                            </p>

                            {[
                                {
                                    icon: Gift,
                                    label: 'Oferecer desconto especial',
                                    description: 'Crie uma promoção personalizada',
                                    color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10',
                                    action: () => window.open(`/contacts/${contact.id}`, '_blank'),
                                },
                                {
                                    icon: FileText,
                                    label: 'Adicionar nota',
                                    description: 'Registre uma observação sobre este cliente',
                                    color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10',
                                    action: () => window.open(`/contacts/${contact.id}`, '_blank'),
                                },
                                {
                                    icon: CheckSquare,
                                    label: 'Criar tarefa de follow-up',
                                    description: 'Agende um acompanhamento',
                                    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10',
                                    action: () => window.open(`/activities?contactId=${contact.id}`, '_blank'),
                                },
                                {
                                    icon: Star,
                                    label: 'Ver perfil completo',
                                    description: 'Histórico, deals e atividades',
                                    color: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10',
                                    action: () => window.open(`/contacts/${contact.id}`, '_blank'),
                                },
                            ].map(action => (
                                <button
                                    key={action.label}
                                    onClick={action.action}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-white/10 hover:border-slate-200 dark:hover:border-white/20 transition-all text-left group"
                                >
                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${action.color}`}>
                                        <action.icon size={15} />
                                    </span>
                                    <div>
                                        <p className="text-sm font-medium text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                            {action.label}
                                        </p>
                                        <p className="text-xs text-slate-400">{action.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
