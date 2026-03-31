/**
 * @fileoverview Hooks: Client Radar
 *
 * TanStack Query hooks para o Radar de Clientes:
 * aniversários, VIPs, datas comemorativas, regras de eventos.
 * Padrão SSOT: setQueryData > invalidateQueries.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/context/ToastContext';
import type {
    RadarSummary,
    BirthdayContact,
    VIPClient,
    CommemorativeDate,
    ClientEventRule,
    EventType,
    UpsertEventRuleInput,
} from '@/lib/supabase/client-radar';

// ── Query Keys ────────────────────────────────────────────────────────────

const radarKeys = {
    all: ['client-radar'] as const,
    summary: () => [...radarKeys.all, 'summary'] as const,
    birthdays: (days: number) => [...radarKeys.all, 'birthdays', days] as const,
    vip: (limit: number) => [...radarKeys.all, 'vip', limit] as const,
    rules: () => [...radarKeys.all, 'rules'] as const,
    commemorative: () => [...radarKeys.all, 'commemorative'] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────

/**
 * Resumo completo do Radar — usado no banner do Dashboard.
 * Revalidado a cada 5 minutos.
 */
export function useRadarSummary() {
    return useQuery<RadarSummary>({
        queryKey: radarKeys.summary(),
        queryFn: async () => {
            const res = await fetch('/api/client-radar');
            if (!res.ok) throw new Error('Failed to fetch radar summary');
            return res.json();
        },
        staleTime: 5 * 60 * 1000, // 5min
        gcTime: 10 * 60 * 1000,
    });
}

/**
 * Lista de aniversariantes próximos.
 */
export function useUpcomingBirthdays(daysAhead = 30) {
    return useQuery<{ birthdays: BirthdayContact[] }>({
        queryKey: radarKeys.birthdays(daysAhead),
        queryFn: async () => {
            const res = await fetch(`/api/client-radar?scope=birthdays&days=${daysAhead}`);
            if (!res.ok) throw new Error('Failed to fetch birthdays');
            return res.json();
        },
        staleTime: 10 * 60 * 1000,
        select: (d) => d,
    });
}

/**
 * Clientes VIP ordenados por score.
 */
export function useVIPClients(limit = 20) {
    return useQuery<{ vipClients: VIPClient[] }>({
        queryKey: radarKeys.vip(limit),
        queryFn: async () => {
            const res = await fetch(`/api/client-radar?scope=vip&limit=${limit}`);
            if (!res.ok) throw new Error('Failed to fetch VIP clients');
            return res.json();
        },
        staleTime: 10 * 60 * 1000,
    });
}

/**
 * Datas comemorativas próximas.
 */
export function useCommemorativeDates() {
    return useQuery<{ dates: CommemorativeDate[] }>({
        queryKey: radarKeys.commemorative(),
        queryFn: async () => {
            const res = await fetch('/api/client-radar?scope=commemorative');
            if (!res.ok) throw new Error('Failed to fetch commemorative dates');
            return res.json();
        },
        staleTime: 60 * 60 * 1000, // 1h — datas não mudam com frequência
    });
}

/**
 * Regras de eventos automatizados.
 */
export function useEventRules() {
    return useQuery<{ rules: ClientEventRule[] }>({
        queryKey: radarKeys.rules(),
        queryFn: async () => {
            const res = await fetch('/api/client-radar?scope=rules');
            if (!res.ok) throw new Error('Failed to fetch event rules');
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Mutation: upsert regra de evento.
 * SSOT: atualiza cache em vez de invalidar.
 */
export function useUpsertEventRule() {
    const qc = useQueryClient();
    const { addToast } = useToast();

    return useMutation<{ rule: ClientEventRule }, Error, UpsertEventRuleInput>({
        mutationFn: async (input) => {
            const res = await fetch('/api/client-radar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: ({ rule }) => {
            qc.setQueryData<{ rules: ClientEventRule[] }>(radarKeys.rules(), (old) => {
                if (!old) return { rules: [rule] };
                const idx = old.rules.findIndex(
                    r => r.event_type === rule.event_type && r.send_days_before === rule.send_days_before
                );
                const updated = [...old.rules];
                if (idx >= 0) updated[idx] = rule;
                else updated.push(rule);
                return { rules: updated };
            });
            addToast('Regra salva!', 'success');
        },
        onError: (err) => {
            addToast(err.message, 'error');
        },
    });
}

/**
 * Mutation: enviar mensagem de evento para um contato.
 */
export function useSendEventMessage() {
    const { addToast } = useToast();

    return useMutation<
        { success: boolean; message_sent: string; contact_name: string },
        Error,
        { contactId: string; eventType: EventType; messageOverride?: string; channel?: 'whatsapp' | 'email' }
    >({
        mutationFn: async (input) => {
            const res = await fetch('/api/client-radar/send-event-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 409) {
                    throw new Error('Mensagem já enviada hoje para este contato.');
                }
                throw new Error(data.error ?? 'Erro ao enviar mensagem');
            }
            return data;
        },
        onSuccess: (data) => {
            addToast(`Mensagem enviada para ${data.contact_name}! 🎉`, 'success');
        },
        onError: (err) => {
            addToast(err.message, 'error');
        },
    });
}
