import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function: vertical-automation
 *
 * Executed by pg_cron jobs to run vertical-specific automation tasks.
 * Each job sends { job, vertical } and this function processes all
 * organizations of that vertical type.
 */

interface AutomationRequest {
    job: string;
    vertical: string;
}

Deno.serve(async (req: Request) => {
    try {
        const { job, vertical } = (await req.json()) as AutomationRequest;

        if (!job || !vertical) {
            return new Response(
                JSON.stringify({ error: "Missing job or vertical" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Fetch all orgs with this vertical
        const { data: orgs } = await supabase
            .from("organizations")
            .select("id")
            .eq("business_type", vertical);

        let processed = 0;

        for (const org of orgs ?? []) {
            try {
                switch (job) {
                    // ── Medical Clinic ──
                    case "check_appointment_reminders":
                        await checkAppointmentReminders(supabase, org.id);
                        break;
                    case "check_patient_reactivation":
                        await checkPatientReactivation(supabase, org.id);
                        break;
                    case "check_absenteeism_alert":
                        await checkAbsenteeismAlert(supabase, org.id);
                        break;

                    // ── Dental Clinic ──
                    case "check_budget_followup":
                        await checkBudgetFollowup(supabase, org.id);
                        break;
                    case "check_treatment_abandonment":
                        await checkTreatmentAbandonment(supabase, org.id);
                        break;
                    case "check_maintenance_due":
                        await checkMaintenanceDue(supabase, org.id);
                        break;

                    // ── Real Estate ──
                    case "check_visit_followup":
                        await checkVisitFollowup(supabase, org.id);
                        break;
                    case "check_proposal_followup":
                        await checkProposalFollowup(supabase, org.id);
                        break;
                    case "run_property_matching":
                        await runPropertyMatching(supabase, org.id);
                        break;

                    default:
                        console.warn(`Unknown job: ${job}`);
                }
                processed++;
            } catch (err) {
                console.error(`Error processing org ${org.id} for job ${job}:`, err);
            }
        }

        return new Response(
            JSON.stringify({ success: true, job, vertical, orgs_processed: processed }),
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("vertical-automation error:", err);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});

// ─── Medical Clinic Automations ──────────────────────────────────────

async function checkAppointmentReminders(supabase: any, orgId: string) {
    const twentyFourHoursFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    // Find deals with upcoming appointments without confirmation
    const { data: cfValues } = await supabase
        .from("custom_field_values")
        .select("entity_id, field_value")
        .eq("organization_id", orgId)
        .eq("entity_type", "deal")
        .eq("field_key", "data_agendamento")
        .gte("field_value", `"${now}"`)
        .lte("field_value", `"${twentyFourHoursFromNow}"`);

    for (const cf of cfValues ?? []) {
        // Check if confirmation exists
        const { data: statusCf } = await supabase
            .from("custom_field_values")
            .select("field_value")
            .eq("entity_id", cf.entity_id)
            .eq("field_key", "status_agendamento")
            .single();

        const status = String(statusCf?.field_value ?? "").replace(/"/g, "");
        if (status === "Confirmado") continue;

        // Check if action item already exists for this deal
        const { data: existing } = await supabase
            .from("inbox_action_items")
            .select("id")
            .eq("organization_id", orgId)
            .eq("deal_id", cf.entity_id)
            .eq("action_type", "appointment_reminder")
            .eq("status", "pending")
            .limit(1);

        if (existing && existing.length > 0) continue;

        const { data: deal } = await supabase
            .from("deals")
            .select("id, title, contact_id, assigned_to")
            .eq("id", cf.entity_id)
            .single();

        if (!deal) continue;

        await supabase.from("inbox_action_items").insert({
            organization_id: orgId,
            user_id: deal.assigned_to,
            deal_id: deal.id,
            contact_id: deal.contact_id,
            title: `Confirmar agendamento: ${deal.title}`,
            description: `Agendamento sem confirmação. Data: ${String(cf.field_value).replace(/"/g, "")}`,
            priority: "high",
            action_type: "appointment_reminder",
            suggested_action: "CALL",
            status: "pending",
            ai_generated: true,
        });
    }
}

async function checkPatientReactivation(supabase: any, orgId: string) {
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString();

    const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, assigned_to")
        .eq("organization_id", orgId)
        .lt("updated_at", sixMonthsAgo)
        .limit(20);

    for (const contact of contacts ?? []) {
        const { data: existing } = await supabase
            .from("inbox_action_items")
            .select("id")
            .eq("organization_id", orgId)
            .eq("contact_id", contact.id)
            .eq("action_type", "patient_reactivation")
            .eq("status", "pending")
            .limit(1);

        if (existing && existing.length > 0) continue;

        await supabase.from("inbox_action_items").insert({
            organization_id: orgId,
            user_id: contact.assigned_to,
            contact_id: contact.id,
            title: `Reativar paciente: ${contact.name}`,
            description: `Sem consulta há mais de 6 meses. Convidar para check-up.`,
            priority: "medium",
            action_type: "patient_reactivation",
            suggested_action: "WHATSAPP",
            status: "pending",
            ai_generated: true,
        });
    }
}

async function checkAbsenteeismAlert(supabase: any, orgId: string) {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

    const { data: todayDeals } = await supabase
        .from("deals")
        .select("id")
        .eq("organization_id", orgId)
        .gte("created_at", startOfDay);

    const dealIds = (todayDeals ?? []).map((d: any) => d.id);
    if (dealIds.length === 0) return;

    const { data: cfValues } = await supabase
        .from("custom_field_values")
        .select("field_value")
        .eq("organization_id", orgId)
        .eq("entity_type", "deal")
        .eq("field_key", "compareceu")
        .in("entity_id", dealIds);

    const total = cfValues?.length ?? 0;
    const absent = cfValues?.filter((cf: any) => cf.field_value === false || cf.field_value === "false").length ?? 0;
    const rate = total > 0 ? (absent / total) * 100 : 0;

    if (rate > 20) {
        // Get an admin to notify
        const { data: admin } = await supabase
            .from("profiles")
            .select("id")
            .eq("organization_id", orgId)
            .eq("role", "admin")
            .limit(1)
            .single();

        if (admin) {
            await supabase.from("inbox_action_items").insert({
                organization_id: orgId,
                user_id: admin.id,
                title: `⚠️ Absenteísmo alto: ${rate.toFixed(0)}%`,
                description: `Taxa de absenteísmo de hoje acima de 20%. ${absent} de ${total} pacientes não compareceram.`,
                priority: "critical",
                action_type: "absenteeism_alert",
                status: "pending",
                ai_generated: true,
            });
        }
    }
}

// ─── Dental Clinic Automations ───────────────────────────────────────

async function checkBudgetFollowup(supabase: any, orgId: string) {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();

    const { data: cfValues } = await supabase
        .from("custom_field_values")
        .select("entity_id")
        .eq("organization_id", orgId)
        .eq("entity_type", "deal")
        .eq("field_key", "status_orcamento")
        .eq("field_value", '"Enviado"');

    const entityIds = (cfValues ?? []).map((cf: any) => cf.entity_id);
    if (entityIds.length === 0) return;

    const { data: staleDeals } = await supabase
        .from("deals")
        .select("id, title, value, contact_id, assigned_to")
        .in("id", entityIds)
        .lt("updated_at", threeDaysAgo);

    for (const deal of staleDeals ?? []) {
        const { data: existing } = await supabase
            .from("inbox_action_items")
            .select("id")
            .eq("organization_id", orgId)
            .eq("deal_id", deal.id)
            .eq("action_type", "budget_followup")
            .eq("status", "pending")
            .limit(1);

        if (existing && existing.length > 0) continue;

        await supabase.from("inbox_action_items").insert({
            organization_id: orgId,
            user_id: deal.assigned_to,
            deal_id: deal.id,
            contact_id: deal.contact_id,
            title: `Follow-up de orçamento: ${deal.title}`,
            description: `Orçamento enviado há mais de 3 dias sem resposta. Valor: R$ ${deal.value ?? 0}`,
            priority: "high",
            action_type: "budget_followup",
            suggested_action: "WHATSAPP",
            status: "pending",
            ai_generated: true,
        });
    }
}

async function checkTreatmentAbandonment(supabase: any, orgId: string) {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000).toISOString();

    const { data: inProgress } = await supabase
        .from("custom_field_values")
        .select("entity_id")
        .eq("organization_id", orgId)
        .eq("entity_type", "deal")
        .eq("field_key", "fase_tratamento")
        .eq("field_value", '"Em Andamento"');

    const entityIds = (inProgress ?? []).map((cf: any) => cf.entity_id);
    if (entityIds.length === 0) return;

    const { data: staleDeals } = await supabase
        .from("deals")
        .select("id, title, contact_id, assigned_to")
        .in("id", entityIds)
        .lt("updated_at", fifteenDaysAgo);

    for (const deal of staleDeals ?? []) {
        const { data: existing } = await supabase
            .from("inbox_action_items")
            .select("id")
            .eq("organization_id", orgId)
            .eq("deal_id", deal.id)
            .eq("action_type", "treatment_abandonment")
            .eq("status", "pending")
            .limit(1);

        if (existing && existing.length > 0) continue;

        await supabase.from("inbox_action_items").insert({
            organization_id: orgId,
            user_id: deal.assigned_to,
            deal_id: deal.id,
            contact_id: deal.contact_id,
            title: `🚨 Abandono de tratamento: ${deal.title}`,
            description: `Tratamento em andamento sem sessão há mais de 15 dias. Risco alto de abandono.`,
            priority: "critical",
            action_type: "treatment_abandonment",
            suggested_action: "CALL",
            status: "pending",
            ai_generated: true,
        });
    }
}

async function checkMaintenanceDue(supabase: any, orgId: string) {
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString();

    const { data: cfValues } = await supabase
        .from("custom_field_values")
        .select("entity_id")
        .eq("organization_id", orgId)
        .eq("entity_type", "contact")
        .eq("field_key", "ultima_manutencao")
        .lt("field_value", `"${sixMonthsAgo}"`);

    for (const cf of cfValues ?? []) {
        const { data: existing } = await supabase
            .from("inbox_action_items")
            .select("id")
            .eq("organization_id", orgId)
            .eq("contact_id", cf.entity_id)
            .eq("action_type", "maintenance_due")
            .eq("status", "pending")
            .limit(1);

        if (existing && existing.length > 0) continue;

        const { data: contact } = await supabase
            .from("contacts")
            .select("name, assigned_to")
            .eq("id", cf.entity_id)
            .single();

        await supabase.from("inbox_action_items").insert({
            organization_id: orgId,
            user_id: contact?.assigned_to,
            contact_id: cf.entity_id,
            title: `Manutenção vencida: ${contact?.name}`,
            description: `Última manutenção há mais de 6 meses. Agendar retorno.`,
            priority: "medium",
            action_type: "maintenance_due",
            suggested_action: "WHATSAPP",
            status: "pending",
            ai_generated: true,
        });
    }
}

// ─── Real Estate Automations ─────────────────────────────────────────

async function checkVisitFollowup(supabase: any, orgId: string) {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();

    const { data: visited } = await supabase
        .from("custom_field_values")
        .select("entity_id, field_value")
        .eq("organization_id", orgId)
        .eq("entity_type", "deal")
        .eq("field_key", "data_visita")
        .lt("field_value", `"${twoDaysAgo}"`);

    for (const cf of visited ?? []) {
        // Check if proposal was already sent
        const { data: proposal } = await supabase
            .from("custom_field_values")
            .select("field_value")
            .eq("entity_id", cf.entity_id)
            .eq("field_key", "proposta_valor")
            .limit(1);

        if (proposal && proposal.length > 0) continue;

        const { data: existing } = await supabase
            .from("inbox_action_items")
            .select("id")
            .eq("organization_id", orgId)
            .eq("deal_id", cf.entity_id)
            .eq("action_type", "visit_followup")
            .eq("status", "pending")
            .limit(1);

        if (existing && existing.length > 0) continue;

        const { data: deal } = await supabase
            .from("deals")
            .select("id, title, contact_id, assigned_to")
            .eq("id", cf.entity_id)
            .single();

        if (!deal) continue;

        await supabase.from("inbox_action_items").insert({
            organization_id: orgId,
            user_id: deal.assigned_to,
            deal_id: deal.id,
            contact_id: deal.contact_id,
            title: `Follow-up pós-visita: ${deal.title}`,
            description: `Visita realizada há mais de 2 dias sem proposta enviada.`,
            priority: "high",
            action_type: "visit_followup",
            suggested_action: "CALL",
            status: "pending",
            ai_generated: true,
        });
    }
}

async function checkProposalFollowup(supabase: any, orgId: string) {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();

    const { data: pendingProposals } = await supabase
        .from("custom_field_values")
        .select("entity_id")
        .eq("organization_id", orgId)
        .eq("entity_type", "deal")
        .eq("field_key", "proposta_status")
        .eq("field_value", '"Pendente"');

    const entityIds = (pendingProposals ?? []).map((cf: any) => cf.entity_id);
    if (entityIds.length === 0) return;

    const { data: staleDeals } = await supabase
        .from("deals")
        .select("id, title, contact_id, assigned_to")
        .in("id", entityIds)
        .lt("updated_at", twoDaysAgo);

    for (const deal of staleDeals ?? []) {
        const { data: existing } = await supabase
            .from("inbox_action_items")
            .select("id")
            .eq("organization_id", orgId)
            .eq("deal_id", deal.id)
            .eq("action_type", "proposal_followup")
            .eq("status", "pending")
            .limit(1);

        if (existing && existing.length > 0) continue;

        await supabase.from("inbox_action_items").insert({
            organization_id: orgId,
            user_id: deal.assigned_to,
            deal_id: deal.id,
            contact_id: deal.contact_id,
            title: `Retorno sobre proposta: ${deal.title}`,
            description: `Proposta enviada há mais de 2 dias sem resposta do cliente.`,
            priority: "high",
            action_type: "proposal_followup",
            suggested_action: "CALL",
            status: "pending",
            ai_generated: true,
        });
    }
}

async function runPropertyMatching(supabase: any, orgId: string) {
    // Fetch available properties
    const { data: properties } = await supabase
        .from("vertical_properties")
        .select("id, property_type, transaction_type, value, bedrooms, area_m2, address_json, assigned_broker_id")
        .eq("organization_id", orgId)
        .eq("status", "disponivel")
        .limit(50);

    if (!properties || properties.length === 0) return;

    // Fetch active buyer/tenant contacts with preferences
    const { data: clientTypes } = await supabase
        .from("custom_field_values")
        .select("entity_id, field_value")
        .eq("organization_id", orgId)
        .eq("entity_type", "contact")
        .eq("field_key", "tipo_cliente")
        .in("field_value", ['"Comprador"', '"Locatário"', '"Investidor"']);

    const clientIds = (clientTypes ?? []).map((cf: any) => cf.entity_id);
    if (clientIds.length === 0) return;

    // Get budget and preference data for each client
    const { data: budgetMin } = await supabase
        .from("custom_field_values")
        .select("entity_id, field_value")
        .in("entity_id", clientIds)
        .eq("field_key", "faixa_orcamento_min");

    const { data: budgetMax } = await supabase
        .from("custom_field_values")
        .select("entity_id, field_value")
        .in("entity_id", clientIds)
        .eq("field_key", "faixa_orcamento_max");

    const budgetMinMap: Record<string, number> = {};
    const budgetMaxMap: Record<string, number> = {};
    (budgetMin ?? []).forEach((cf: any) => { budgetMinMap[cf.entity_id] = Number(cf.field_value) || 0; });
    (budgetMax ?? []).forEach((cf: any) => { budgetMaxMap[cf.entity_id] = Number(cf.field_value) || Infinity; });

    // Simple matching: check if property value falls within client budget
    for (const clientId of clientIds) {
        const min = budgetMinMap[clientId] ?? 0;
        const max = budgetMaxMap[clientId] ?? Infinity;

        const matches = properties.filter((p: any) => {
            const pValue = Number(p.value) || 0;
            return pValue >= min && pValue <= max;
        });

        if (matches.length === 0) continue;

        // Check if match notification already exists
        const { data: existing } = await supabase
            .from("inbox_action_items")
            .select("id")
            .eq("organization_id", orgId)
            .eq("contact_id", clientId)
            .eq("action_type", "property_match")
            .eq("status", "pending")
            .limit(1);

        if (existing && existing.length > 0) continue;

        const { data: contact } = await supabase
            .from("contacts")
            .select("name, assigned_to")
            .eq("id", clientId)
            .single();

        const brokerId = matches[0].assigned_broker_id ?? contact?.assigned_to;

        await supabase.from("inbox_action_items").insert({
            organization_id: orgId,
            user_id: brokerId,
            contact_id: clientId,
            title: `Match: ${matches.length} imóveis para ${contact?.name}`,
            description: `${matches.length} imóvel(is) compatível(is) com o perfil do cliente. Faixa: R$ ${min.toLocaleString("pt-BR")}-${max < Infinity ? `R$ ${max.toLocaleString("pt-BR")}` : "sem limite"}.`,
            priority: "medium",
            action_type: "property_match",
            suggested_action: "WHATSAPP",
            status: "pending",
            ai_generated: true,
        });
    }
}
