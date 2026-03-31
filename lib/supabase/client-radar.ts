/**
 * @fileoverview Client Radar — Inteligência de Clientes
 *
 * Serviço para aniversários, clientes VIP, datas comemorativas
 * e regras de eventos automatizados.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────────────

export type Gender = 'masculino' | 'feminino' | 'outro' | 'nao_informado';

export type EventType =
    | 'birthday'
    | 'womens_day'
    | 'mothers_day'
    | 'fathers_day'
    | 'valentines_day'
    | 'christmas'
    | 'new_year'
    | 'customer_day'
    | 'custom';

export interface BirthdayContact {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatar: string | null;
    gender: Gender | null;
    birth_date: string | null;
    stage: string;
    total_value: number;
    days_until_birthday: number;
    next_birthday_date: string;
    turning_age: number;
}

export interface VIPClient {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatar: string | null;
    gender: Gender | null;
    birth_date: string | null;
    stage: string;
    total_value: number;
    won_deals_count: number;
    won_deals_value: number;
    activities_count: number;
    vip_score: number;
}

export interface CommemorativeDate {
    id: EventType;
    name: string;
    date: string; // ISO date
    daysUntil: number;
    emoji: string;
    targetGender: 'masculino' | 'feminino' | null; // null = todos
    description: string;
}

export interface ClientEventRule {
    id: string;
    organization_id: string;
    event_type: EventType;
    is_enabled: boolean;
    send_days_before: number;
    send_time: string;
    message_template: string | null;
    target_gender: Gender | null;
    channel: 'whatsapp' | 'email' | 'both';
    created_at: string;
    updated_at: string;
}

export interface RadarSummary {
    todayBirthdays: BirthdayContact[];
    upcomingBirthdays: BirthdayContact[];   // próximos 7 dias (excl. hoje)
    nextWeekBirthdays: BirthdayContact[];   // 8-30 dias
    vipClients: VIPClient[];
    upcomingDates: CommemorativeDate[];
    totalWithBirthdate: number;
    totalVIP: number;
}

export type UpsertEventRuleInput = Omit<ClientEventRule, 'id' | 'organization_id' | 'created_at' | 'updated_at'>;

// ── Helpers: Datas Comemorativas ───────────────────────────────────────────

/**
 * Calcula o N-ésimo dia da semana de um mês/ano específico.
 * @param year Ano
 * @param month Mês (1-12)
 * @param dayOfWeek Dia da semana (0=Dom, 1=Seg, ..., 6=Sab)
 * @param nth Qual ocorrência (1, 2, 3...)
 */
function nthDayOfMonth(year: number, month: number, dayOfWeek: number, nth: number): Date {
    const first = new Date(year, month - 1, 1);
    const firstDow = first.getDay();
    const offset = (dayOfWeek - firstDow + 7) % 7;
    const day = 1 + offset + (nth - 1) * 7;
    return new Date(year, month - 1, day);
}

function toISO(d: Date): string {
    return d.toISOString().split('T')[0];
}

function daysDiff(from: Date, to: Date): number {
    const ms = to.getTime() - from.getTime();
    return Math.round(ms / (1000 * 60 * 60 * 24));
}

/**
 * Retorna as próximas datas comemorativas relevantes (próximos 90 dias).
 */
export function getUpcomingCommemorativeDates(referenceDate = new Date()): CommemorativeDate[] {
    const year = referenceDate.getFullYear();
    const nextYear = year + 1;

    const candidates: Omit<CommemorativeDate, 'daysUntil'>[] = [
        {
            id: 'new_year',
            name: 'Ano Novo',
            date: `${year}-01-01`,
            emoji: '🎆',
            targetGender: null,
            description: 'Envie mensagens de Feliz Ano Novo para todos os clientes.',
        },
        {
            id: 'womens_day',
            name: 'Dia da Mulher',
            date: `${year}-03-08`,
            emoji: '💜',
            targetGender: 'feminino',
            description: 'Mensagem especial para clientes mulheres.',
        },
        {
            id: 'valentines_day',
            name: 'Dia dos Namorados',
            date: `${year}-06-12`,
            emoji: '❤️',
            targetGender: null,
            description: 'Ofereça promoções especiais de Dia dos Namorados.',
        },
        {
            id: 'mothers_day',
            name: 'Dia das Mães',
            date: toISO(nthDayOfMonth(year, 5, 0, 2)), // 2º domingo de maio
            emoji: '🌸',
            targetGender: 'feminino',
            description: 'Homenageie as mães na sua base de clientes.',
        },
        {
            id: 'fathers_day',
            name: 'Dia dos Pais',
            date: toISO(nthDayOfMonth(year, 8, 0, 2)), // 2º domingo de agosto
            emoji: '👨‍👧',
            targetGender: 'masculino',
            description: 'Homenageie os pais na sua base de clientes.',
        },
        {
            id: 'customer_day',
            name: 'Dia do Cliente',
            date: `${year}-09-15`,
            emoji: '🤝',
            targetGender: null,
            description: 'Ofereça benefícios e agradecimentos a todos os clientes.',
        },
        {
            id: 'christmas',
            name: 'Natal',
            date: `${year}-12-25`,
            emoji: '🎄',
            targetGender: null,
            description: 'Mensagem de Feliz Natal para todos.',
        },
        // Ano seguinte — para datas que já passaram em 2026
        {
            id: 'new_year',
            name: 'Ano Novo',
            date: `${nextYear}-01-01`,
            emoji: '🎆',
            targetGender: null,
            description: 'Envie mensagens de Feliz Ano Novo para todos os clientes.',
        },
        {
            id: 'womens_day',
            name: 'Dia da Mulher',
            date: `${nextYear}-03-08`,
            emoji: '💜',
            targetGender: 'feminino',
            description: 'Mensagem especial para clientes mulheres.',
        },
    ];

    const results: CommemorativeDate[] = [];
    const seen = new Set<string>();

    for (const c of candidates) {
        const diff = daysDiff(referenceDate, new Date(c.date + 'T00:00:00'));
        if (diff >= -1 && diff <= 90 && !seen.has(c.id + c.date)) {
            seen.add(c.id + c.date);
            results.push({ ...c, daysUntil: Math.max(0, diff) });
        }
    }

    return results.sort((a, b) => a.daysUntil - b.daysUntil);
}

// ── Service Functions ──────────────────────────────────────────────────────

/**
 * Retorna aniversariantes próximos para uma organização.
 * @param daysAhead Quantos dias à frente buscar (default: 30)
 */
export async function getUpcomingBirthdays(
    supabase: SupabaseClient,
    organizationId: string,
    daysAhead = 30
): Promise<BirthdayContact[]> {
    const { data, error } = await supabase
        .from('vw_upcoming_birthdays')
        .select('*')
        .eq('organization_id', organizationId)
        .lte('days_until_birthday', daysAhead)
        .order('days_until_birthday', { ascending: true });

    if (error) throw error;
    return (data ?? []) as BirthdayContact[];
}

/**
 * Retorna clientes VIP ordenados por score.
 */
export async function getVIPClients(
    supabase: SupabaseClient,
    organizationId: string,
    limit = 20
): Promise<VIPClient[]> {
    const { data, error } = await supabase
        .from('vw_vip_clients')
        .select('*')
        .eq('organization_id', organizationId)
        .gt('vip_score', 0)
        .order('vip_score', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return (data ?? []) as VIPClient[];
}

/**
 * Retorna o resumo completo do Radar (para o banner do dashboard).
 */
export async function getRadarSummary(
    supabase: SupabaseClient,
    organizationId: string
): Promise<RadarSummary> {
    const [birthdays, vips] = await Promise.all([
        getUpcomingBirthdays(supabase, organizationId, 30),
        getVIPClients(supabase, organizationId, 10),
    ]);

    const todayBirthdays = birthdays.filter(b => b.days_until_birthday === 0);
    const upcomingBirthdays = birthdays.filter(b => b.days_until_birthday > 0 && b.days_until_birthday <= 7);
    const nextWeekBirthdays = birthdays.filter(b => b.days_until_birthday > 7);
    const upcomingDates = getUpcomingCommemorativeDates();

    return {
        todayBirthdays,
        upcomingBirthdays,
        nextWeekBirthdays,
        vipClients: vips,
        upcomingDates,
        totalWithBirthdate: birthdays.length,
        totalVIP: vips.length,
    };
}

/**
 * Retorna as regras de eventos de uma organização.
 */
export async function getEventRules(
    supabase: SupabaseClient,
    organizationId: string
): Promise<ClientEventRule[]> {
    const { data, error } = await supabase
        .from('client_event_rules')
        .select('*')
        .eq('organization_id', organizationId)
        .order('event_type');

    if (error) throw error;
    return (data ?? []) as ClientEventRule[];
}

/**
 * Cria ou atualiza uma regra de evento.
 */
export async function upsertEventRule(
    supabase: SupabaseClient,
    organizationId: string,
    rule: UpsertEventRuleInput
): Promise<ClientEventRule> {
    const { data, error } = await supabase
        .from('client_event_rules')
        .upsert(
            { ...rule, organization_id: organizationId },
            { onConflict: 'organization_id,event_type,send_days_before' }
        )
        .select()
        .single();

    if (error) throw error;
    return data as ClientEventRule;
}

/**
 * Registra o envio de uma mensagem de evento.
 */
export async function logEventSend(
    supabase: SupabaseClient,
    organizationId: string,
    contactId: string,
    eventType: EventType,
    eventDate: string,
    channel: string,
    messageSent: string,
    status: 'sent' | 'failed' | 'skipped' = 'sent',
    errorMessage?: string
): Promise<void> {
    await supabase.from('client_event_sends').insert({
        organization_id: organizationId,
        contact_id: contactId,
        event_type: eventType,
        event_date: eventDate,
        channel,
        message_sent: messageSent,
        status,
        error_message: errorMessage ?? null,
    });
}

/**
 * Verifica se um evento já foi enviado para um contato na data especificada.
 */
export async function hasEventBeenSent(
    supabase: SupabaseClient,
    contactId: string,
    eventType: EventType,
    eventDate: string
): Promise<boolean> {
    const { data } = await supabase
        .from('client_event_sends')
        .select('id')
        .eq('contact_id', contactId)
        .eq('event_type', eventType)
        .eq('event_date', eventDate)
        .eq('status', 'sent')
        .limit(1);

    return (data?.length ?? 0) > 0;
}

/**
 * Retorna os envios recentes de uma organização.
 */
export async function getRecentEventSends(
    supabase: SupabaseClient,
    organizationId: string,
    limit = 50
) {
    const { data, error } = await supabase
        .from('client_event_sends')
        .select(`
            *,
            contacts:contact_id(name, avatar, phone)
        `)
        .eq('organization_id', organizationId)
        .order('sent_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data ?? [];
}

// ── Templates de mensagem padrão ──────────────────────────────────────────

export const DEFAULT_MESSAGE_TEMPLATES: Record<EventType, string> = {
    birthday: 'Olá {{contact.first_name}}! 🎉 A equipe da {{org.name}} deseja a você um feliz aniversário! Que este dia seja repleto de alegrias. 🎂',
    womens_day: 'Parabéns pelo Dia Internacional da Mulher, {{contact.first_name}}! 💜 Agradecemos por fazer parte da nossa história. Com carinho, {{org.name}}.',
    mothers_day: 'Feliz Dia das Mães, {{contact.first_name}}! 🌸 Uma homenagem especial para você. Muito obrigado por confiar em nós!',
    fathers_day: 'Feliz Dia dos Pais, {{contact.first_name}}! 👨‍👧 Uma homenagem especial para você. Muito obrigado por confiar em nós!',
    valentines_day: 'Feliz Dia dos Namorados, {{contact.first_name}}! ❤️ Que o amor seja sempre a força que nos une. Com carinho, {{org.name}}.',
    christmas: 'Feliz Natal, {{contact.first_name}}! 🎄 Que este Natal seja repleto de paz, saúde e alegria para você e sua família. {{org.name}}.',
    new_year: 'Feliz Ano Novo, {{contact.first_name}}! 🎆 Que {{next_year}} seja um ano repleto de conquistas e saúde. {{org.name}} agradece sua confiança!',
    customer_day: 'Hoje é Dia do Cliente e queremos homenagear você, {{contact.first_name}}! 🤝 Obrigado por ser tão especial para nós. {{org.name}}.',
    custom: '',
};

/**
 * Interpola variáveis em um template de mensagem.
 */
export function interpolateTemplate(
    template: string,
    contact: { name: string; [key: string]: unknown },
    org: { name: string; [key: string]: unknown } = { name: 'nossa equipe' }
): string {
    const firstName = contact.name?.split(' ')[0] ?? contact.name;
    const nextYear = new Date().getFullYear() + 1;

    return template
        .replace(/\{\{contact\.name\}\}/g, contact.name)
        .replace(/\{\{contact\.first_name\}\}/g, firstName)
        .replace(/\{\{org\.name\}\}/g, org.name)
        .replace(/\{\{next_year\}\}/g, String(nextYear));
}
