/**
 * Notification Preferences Settings Component
 * 
 * Painel de configuração de preferências de notificação por evento.
 * Toggle por tipo de evento + configurações extras (threshold, etc).
 */
import React from 'react';
import {
    Bell,
    BellOff,
    AlertTriangle,
    Calendar,
    Sunrise,
    Trophy,
    Plus,
    ArrowRightLeft,
    Loader2,
} from 'lucide-react';
import {
    useNotificationPreferences,
    useUpdateNotificationPreference,
} from '../hooks/useNotifications';
import {
    EVENT_TYPE_CONFIGS,
    type NotificationEventType,
    type NotificationChannel,
} from '@/lib/supabase/notifications';

const EVENT_ICONS: Record<string, typeof Bell> = {
    stagnation: AlertTriangle,
    activity_reminder: Calendar,
    daily_summary: Sunrise,
    win_loss: Trophy,
    deal_created: Plus,
    deal_stage_changed: ArrowRightLeft,
};

export const NotificationPreferencesSection: React.FC = () => {
    const { data: preferences, isLoading } = useNotificationPreferences();
    const updatePreference = useUpdateNotificationPreference();

    const getPreference = (eventType: NotificationEventType, channel: NotificationChannel) => {
        return preferences?.find(p => p.event_type === eventType && p.channel === channel);
    };

    const togglePreference = (
        eventType: NotificationEventType,
        channel: NotificationChannel,
        currentEnabled: boolean,
        currentConfig?: Record<string, any>
    ) => {
        updatePreference.mutate({
            event_type: eventType,
            channel,
            enabled: !currentEnabled,
            config: currentConfig,
        });
    };

    const updateConfig = (
        eventType: NotificationEventType,
        channel: NotificationChannel,
        key: string,
        value: any,
        enabled: boolean
    ) => {
        const pref = getPreference(eventType, channel);
        updatePreference.mutate({
            event_type: eventType,
            channel,
            enabled,
            config: { ...(pref?.config || {}), [key]: value },
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Bell className="w-6 h-6 text-blue-500" />
                    Preferências de Notificação
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Configure quais notificações você deseja receber.
                </p>
            </div>

            <div className="space-y-3">
                {(Object.entries(EVENT_TYPE_CONFIGS) as [NotificationEventType, typeof EVENT_TYPE_CONFIGS[NotificationEventType]][]).map(
                    ([eventType, config]) => {
                        const Icon = EVENT_ICONS[eventType] || Bell;
                        const emailPref = getPreference(eventType, 'email');
                        const emailEnabled = emailPref?.enabled ?? config.defaultEnabled;

                        return (
                            <div
                                key={eventType}
                                className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${emailEnabled ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-slate-50 dark:bg-white/5'}`}>
                                            <Icon className={`w-4 h-4 ${emailEnabled ? 'text-blue-500' : 'text-slate-400'}`} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                                                {config.label}
                                            </h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {config.description}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Email Toggle */}
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400">In-App</span>
                                            <button
                                                onClick={() => togglePreference(eventType, 'email', emailEnabled, emailPref?.config)}
                                                disabled={updatePreference.isPending}
                                                className={`relative w-10 h-5 rounded-full transition-colors ${emailEnabled
                                                        ? 'bg-blue-500'
                                                        : 'bg-slate-200 dark:bg-white/10'
                                                    }`}
                                            >
                                                <span
                                                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${emailEnabled ? 'translate-x-5' : 'translate-x-0.5'
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Config fields (if enabled and has config schema) */}
                                {emailEnabled && config.configSchema && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex flex-wrap gap-4">
                                        {config.configSchema.map(field => {
                                            const currentValue = emailPref?.config?.[field.key] ?? field.default;
                                            return (
                                                <div key={field.key} className="flex items-center gap-2">
                                                    <label className="text-xs text-slate-500 dark:text-slate-400">
                                                        {field.label}:
                                                    </label>
                                                    {field.type === 'number' ? (
                                                        <input
                                                            type="number"
                                                            value={currentValue}
                                                            onChange={(e) =>
                                                                updateConfig(eventType, 'email', field.key, Number(e.target.value), emailEnabled)
                                                            }
                                                            min={1}
                                                            className="w-20 px-2 py-1 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    ) : (
                                                        <input
                                                            type="checkbox"
                                                            checked={!!currentValue}
                                                            onChange={(e) =>
                                                                updateConfig(eventType, 'email', field.key, e.target.checked, emailEnabled)
                                                            }
                                                            className="accent-blue-500"
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    }
                )}
            </div>

            {/* Info */}
            <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-lg p-3">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                    💡 As notificações in-app aparecem no sino 🔔 do menu.
                    Notificações de email serão enviadas para o endereço cadastrado na sua conta.
                </p>
            </div>
        </div>
    );
};

export default NotificationPreferencesSection;
