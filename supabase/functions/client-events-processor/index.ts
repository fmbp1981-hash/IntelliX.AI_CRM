/**
 * client-events-processor — Edge Function
 *
 * Processa eventos diários de clientes: aniversários e datas comemorativas.
 * Chamada pelo pg_cron às 08:00 BRT (11:00 UTC) todo dia.
 *
 * Fluxo por organização:
 *  1. Busca regras de eventos ativas (client_event_rules)
 *  2. Para cada regra, identifica contatos elegíveis (aniversário ou gênero p/ datas comemorativas)
 *  3. Verifica se mensagem já foi enviada hoje (idempotência via client_event_sends)
 *  4. Envia via Evolution API (WhatsApp) ou registra tentativa
 *  5. Loga resultado em client_event_sends
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType =
    | 'birthday'
    | 'womens_day'
    | 'mothers_day'
    | 'fathers_day'
    | 'valentines_day'
    | 'christmas'
    | 'new_year'
    | 'customer_day'
    | 'custom';

interface EventRule {
    id: string;
    organization_id: string;
    event_type: EventType;
    is_active: boolean;
    send_days_before: number;
    message_template: string | null;
    channel: 'whatsapp' | 'email' | 'both';
    gender_filter: string | null;
}

interface Contact {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    gender: string | null;
    birthday: string | null;
}

interface AgentConfig {
    whatsapp_config: Record<string, string> | null;
    is_active: boolean;
}

// ─── Default Templates ────────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: Record<EventType, string> = {
    birthday: 'Olá {{contact.first_name}}! 🎂 A equipe da {{org.name}} deseja a você um feliz aniversário! Que este novo ciclo seja repleto de realizações. 🥳',
    womens_day: 'Olá {{contact.first_name}}! 💜 No Dia Internacional da Mulher, a {{org.name}} celebra você e toda a sua força. Parabéns!',
    mothers_day: 'Olá {{contact.first_name}}! 🌸 Feliz Dia das Mães! A equipe da {{org.name}} deseja muita saúde e alegria para você e sua família.',
    fathers_day: 'Olá {{contact.first_name}}! 👨‍👧 Feliz Dia dos Pais! A {{org.name}} celebra você neste dia especial. Parabéns!',
    valentines_day: 'Olá {{contact.first_name}}! ❤️ Feliz Dia dos Namorados da equipe da {{org.name}}! Que o amor esteja sempre presente.',
    christmas: 'Olá {{contact.first_name}}! 🎄 Feliz Natal! A {{org.name}} deseja a você e à sua família um Natal cheio de paz e alegria.',
    new_year: 'Olá {{contact.first_name}}! 🎆 Feliz Ano Novo! A equipe da {{org.name}} deseja a você um 2025 repleto de conquistas e saúde.',
    customer_day: 'Olá {{contact.first_name}}! 🤝 Hoje é o Dia do Cliente e a {{org.name}} quer agradecer pela sua confiança e parceria. Obrigado!',
    custom: 'Olá {{contact.first_name}}! A equipe da {{org.name}} tem uma mensagem especial para você.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function interpolate(template: string, contact: Contact, orgName: string): string {
    const firstName = contact.name.split(' ')[0];
    return template
        .replace(/\{\{contact\.first_name\}\}/g, firstName)
        .replace(/\{\{contact\.name\}\}/g, contact.name)
        .replace(/\{\{org\.name\}\}/g, orgName);
}

/** Returns today's date in YYYY-MM-DD format (UTC). */
function today(): string {
    return new Date().toISOString().split('T')[0];
}

/** Checks if a birthday falls within `daysAhead` days from now (UTC). */
function birthdayIsWithinDays(birthday: string, daysAhead: number): boolean {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const [, month, day] = birthday.split('-').map(Number);

    let nextBirthday = new Date(Date.UTC(currentYear, month - 1, day));
    if (nextBirthday < now) {
        nextBirthday = new Date(Date.UTC(currentYear + 1, month - 1, day));
    }

    const msUntil = nextBirthday.getTime() - now.setUTCHours(0, 0, 0, 0);
    const daysUntil = Math.round(msUntil / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= daysAhead;
}

/** nthDayOfMonth — returns date of the nth occurrence of dayOfWeek (0=Sun) in month/year */
function nthDayOfMonth(year: number, month: number, dayOfWeek: number, nth: number): Date {
    const first = new Date(Date.UTC(year, month - 1, 1));
    const offset = (dayOfWeek - first.getUTCDay() + 7) % 7;
    const day = 1 + offset + (nth - 1) * 7;
    return new Date(Date.UTC(year, month - 1, day));
}

/** Returns the YYYY-MM-DD of a fixed or dynamic commemorative date for the current year. */
function getCommemorativeDateStr(eventType: EventType): string | null {
    const now = new Date();
    const y = now.getUTCFullYear();

    const fixed: Partial<Record<EventType, string>> = {
        womens_day: `${y}-03-08`,
        valentines_day: `${y}-06-12`,
        christmas: `${y}-12-25`,
        new_year: `${y}-01-01`,
        customer_day: `${y}-09-15`,
    };

    if (fixed[eventType]) return fixed[eventType]!;

    if (eventType === 'mothers_day') {
        const d = nthDayOfMonth(y, 5, 0, 2); // 2nd Sunday of May
        return d.toISOString().split('T')[0];
    }
    if (eventType === 'fathers_day') {
        const d = nthDayOfMonth(y, 8, 0, 2); // 2nd Sunday of August
        return d.toISOString().split('T')[0];
    }

    return null;
}

/** Checks if today (±daysAhead) matches the commemorative date for this event. */
function commemorativeDateMatchesToday(eventType: EventType, daysAhead: number): boolean {
    const dateStr = getCommemorativeDateStr(eventType);
    if (!dateStr) return false;

    const eventDate = new Date(dateStr + 'T00:00:00Z');
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    const msUntil = eventDate.getTime() - now.getTime();
    const daysUntil = Math.round(msUntil / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= daysAhead;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
    // Allow cron invocations (no auth body) and manual calls with a secret
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const todayStr = today();

    let totalSent = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    try {
        // 1. Fetch all active event rules grouped by org
        const { data: rules, error: rulesError } = await supabase
            .from('client_event_rules')
            .select('*')
            .eq('is_active', true);

        if (rulesError) {
            console.error('[client-events-processor] Error fetching rules:', rulesError);
            return new Response(JSON.stringify({ error: rulesError.message }), { status: 500 });
        }

        if (!rules || rules.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No active rules', sent: 0, skipped: 0, failed: 0 }),
                { headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Group rules by org
        const rulesByOrg: Record<string, EventRule[]> = {};
        for (const rule of rules as EventRule[]) {
            if (!rulesByOrg[rule.organization_id]) rulesByOrg[rule.organization_id] = [];
            rulesByOrg[rule.organization_id].push(rule);
        }

        // Process each org
        for (const [orgId, orgRules] of Object.entries(rulesByOrg)) {
            // Fetch org name + agent config in parallel
            const [orgRes, agentRes] = await Promise.all([
                supabase.from('organizations').select('name').eq('id', orgId).single(),
                supabase
                    .from('agent_configs')
                    .select('whatsapp_config, is_active')
                    .eq('organization_id', orgId)
                    .single(),
            ]);

            const orgName = orgRes.data?.name ?? 'Nossa Equipe';
            const agentConfig = agentRes.data as AgentConfig | null;

            // Fetch all contacts for this org (with birthday and gender)
            const { data: contacts } = await supabase
                .from('contacts')
                .select('id, name, phone, email, gender, birthday')
                .eq('organization_id', orgId)
                .not('phone', 'is', null);

            if (!contacts || contacts.length === 0) continue;

            for (const rule of orgRules) {
                // Determine eligible contacts for this rule
                let eligible: Contact[] = [];

                if (rule.event_type === 'birthday') {
                    eligible = (contacts as Contact[]).filter(
                        c => c.birthday && birthdayIsWithinDays(c.birthday, rule.send_days_before)
                    );
                } else {
                    // Commemorative date — check if date falls today (within window)
                    if (!commemorativeDateMatchesToday(rule.event_type, rule.send_days_before)) {
                        continue;
                    }

                    // Apply gender filter if set
                    if (rule.gender_filter && rule.gender_filter !== 'all') {
                        eligible = (contacts as Contact[]).filter(c => c.gender === rule.gender_filter);
                    } else {
                        eligible = contacts as Contact[];
                    }
                }

                if (eligible.length === 0) continue;

                // Check already-sent for this org+event+today in bulk
                const { data: alreadySentRows } = await supabase
                    .from('client_event_sends')
                    .select('contact_id')
                    .eq('organization_id', orgId)
                    .eq('event_type', rule.event_type)
                    .eq('send_date', todayStr);

                const alreadySentIds = new Set((alreadySentRows ?? []).map((r: { contact_id: string }) => r.contact_id));

                for (const contact of eligible) {
                    if (alreadySentIds.has(contact.id)) {
                        totalSkipped++;
                        continue;
                    }

                    const template = rule.message_template || DEFAULT_TEMPLATES[rule.event_type] || '';
                    const message = interpolate(template, contact, orgName);

                    if (!message.trim()) {
                        totalSkipped++;
                        continue;
                    }

                    let sendResult: { success: boolean; error?: string } = { success: false };

                    // Send via WhatsApp if channel allows and agent is configured
                    if (
                        (rule.channel === 'whatsapp' || rule.channel === 'both') &&
                        agentConfig?.is_active &&
                        agentConfig.whatsapp_config &&
                        contact.phone
                    ) {
                        const cfg = agentConfig.whatsapp_config;
                        if (cfg.api_url && cfg.api_key && cfg.instance_name) {
                            const phone = contact.phone.replace(/\D/g, '');
                            try {
                                const res = await fetch(
                                    `${cfg.api_url}/message/sendText/${cfg.instance_name}`,
                                    {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            apikey: cfg.api_key,
                                        },
                                        body: JSON.stringify({ number: phone, text: message, delay: 1200 }),
                                    }
                                );
                                sendResult = {
                                    success: res.ok,
                                    error: res.ok ? undefined : await res.text(),
                                };
                            } catch (e) {
                                sendResult = { success: false, error: String(e) };
                            }
                        }
                    }

                    // Log the send attempt
                    await supabase.from('client_event_sends').insert({
                        organization_id: orgId,
                        contact_id: contact.id,
                        event_type: rule.event_type,
                        send_date: todayStr,
                        channel: rule.channel === 'both' ? 'whatsapp' : rule.channel,
                        message_sent: message,
                        status: sendResult.success ? 'sent' : 'failed',
                        error_message: sendResult.error ?? null,
                    });

                    if (sendResult.success) totalSent++;
                    else totalFailed++;
                }
            }
        }

        return new Response(
            JSON.stringify({
                message: 'Client events processed',
                date: todayStr,
                sent: totalSent,
                skipped: totalSkipped,
                failed: totalFailed,
            }),
            { headers: { 'Content-Type': 'application/json' } }
        );

    } catch (err) {
        console.error('[client-events-processor] Unexpected error:', err);
        return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
    }
});
