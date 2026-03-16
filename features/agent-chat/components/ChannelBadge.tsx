import React from 'react';
import { MessageCircle, Instagram, Send, Globe, Smartphone } from 'lucide-react';

export type ChannelType = 'whatsapp' | 'instagram' | 'telegram' | 'web' | 'sms';

interface ChannelBadgeProps {
    channel: ChannelType;
    showLabel?: boolean;
    className?: string;
}

export function ChannelBadge({ channel, showLabel = false, className = '' }: ChannelBadgeProps) {
    const config = {
        whatsapp: {
            icon: MessageCircle,
            label: 'WhatsApp',
            colors: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border-green-200 dark:border-green-800/50',
            fill: 'fill-green-600 dark:fill-green-400'
        },
        instagram: {
            icon: Instagram,
            label: 'Instagram',
            colors: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-800/50',
            fill: 'fill-none' // Lucide Instagram icon doesn't look well filled by default
        },
        telegram: {
            icon: Send,
            label: 'Telegram',
            colors: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400 border-sky-200 dark:border-sky-800/50',
            fill: 'fill-sky-600 dark:fill-sky-400'
        },
        web: {
            icon: Globe,
            label: 'Web Chat',
            colors: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50',
            fill: 'fill-none'
        },
        sms: {
            icon: Smartphone,
            label: 'SMS',
            colors: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
            fill: 'fill-none'
        }
    };

    const style = config[channel] || config.web;
    const Icon = style.icon;

    return (
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${style.colors} ${className}`}>
            <Icon size={12} className={style.fill} />
            {showLabel && <span>{style.label}</span>}
        </div>
    );
}
