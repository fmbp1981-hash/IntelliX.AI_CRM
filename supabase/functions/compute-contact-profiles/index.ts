import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Edge Function: compute-contact-profiles
 *
 * Computa perfis comportamentais (RFM, ticket médio, produtos, sazonalidade,
 * risco de churn) para todos os contatos de todas as orgs.
 *
 * Agendado via pg_cron às 03:00 UTC diariamente.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    // Fetch all organizations
    const { data: orgs, error: orgError } = await supabase
      .from("organizations")
      .select("id");

    if (orgError) throw orgError;

    let processed = 0;
    let errors = 0;

    for (const org of orgs ?? []) {
      try {
        // Fetch won deals for this org with product info
        const { data: deals, error: dealsError } = await supabase
          .from("deals")
          .select("id, contact_id, value, product_name, product_category, closed_at, created_at")
          .eq("organization_id", org.id)
          .eq("is_won", true)
          .not("contact_id", "is", null);

        if (dealsError) {
          console.error(`[compute-profiles] Org ${org.id} deals error:`, dealsError.message);
          errors++;
          continue;
        }

        // Fetch all contacts for this org
        const { data: contacts, error: contactsError } = await supabase
          .from("contacts")
          .select("id, created_at")
          .eq("organization_id", org.id);

        if (contactsError) {
          errors++;
          continue;
        }

        // Group deals by contact
        const dealsByContact = new Map<string, typeof deals>();
        for (const deal of deals ?? []) {
          if (!deal.contact_id) continue;
          if (!dealsByContact.has(deal.contact_id)) {
            dealsByContact.set(deal.contact_id, []);
          }
          dealsByContact.get(deal.contact_id)!.push(deal);
        }

        // Compute profile for each contact
        for (const contact of contacts ?? []) {
          const contactDeals = dealsByContact.get(contact.id) ?? [];
          const profile = computeProfile(contact.id, org.id, contactDeals, now);

          const { error: upsertError } = await supabase
            .from("contact_behavioral_profile")
            .upsert(profile, { onConflict: "contact_id" });

          if (upsertError) {
            console.error(`[compute-profiles] Upsert error for contact ${contact.id}:`, upsertError.message);
            errors++;
          } else {
            processed++;
          }
        }
      } catch (orgErr) {
        console.error(`[compute-profiles] Org ${org.id} error:`, orgErr);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed, errors }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[compute-contact-profiles]", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// ── Profile Computation ────────────────────────────────────────────────────────

interface DealRow {
  id: string;
  contact_id: string;
  value: number;
  product_name: string | null;
  product_category: string | null;
  closed_at: string | null;
  created_at: string;
}

function computeProfile(contactId: string, orgId: string, deals: DealRow[], now: Date) {
  const wonDeals = deals.filter((d) => d.closed_at);

  // ── Ticket & Revenue ──
  const totalRevenue = wonDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const avgTicket = wonDeals.length > 0 ? totalRevenue / wonDeals.length : 0;

  // ── Last purchase ──
  const sortedByDate = [...wonDeals].sort(
    (a, b) => new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime()
  );
  const lastPurchaseDate = sortedByDate[0]?.closed_at ?? null;
  const daysSinceLast = lastPurchaseDate
    ? Math.floor((now.getTime() - new Date(lastPurchaseDate).getTime()) / 86400000)
    : 999;

  // ── Preferred products ──
  const productCount = new Map<string, { category: string; count: number; last_date: string }>();
  for (const d of wonDeals) {
    if (!d.product_name) continue;
    const key = d.product_name;
    const existing = productCount.get(key);
    if (existing) {
      existing.count++;
      if (d.closed_at && d.closed_at > existing.last_date) existing.last_date = d.closed_at;
    } else {
      productCount.set(key, {
        category: d.product_category ?? "unknown",
        count: 1,
        last_date: d.closed_at ?? d.created_at,
      });
    }
  }
  const preferred_products = Array.from(productCount.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Preferred categories ──
  const catRevenue = new Map<string, { count: number; revenue: number }>();
  for (const d of wonDeals) {
    const cat = d.product_category ?? "unknown";
    const ex = catRevenue.get(cat) ?? { count: 0, revenue: 0 };
    ex.count++;
    ex.revenue += d.value ?? 0;
    catRevenue.set(cat, ex);
  }
  const preferred_categories = Array.from(catRevenue.entries())
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // ── Peak months ──
  const monthData = new Map<number, { deals_count: number; revenue: number }>();
  for (const d of wonDeals) {
    if (!d.closed_at) continue;
    const month = new Date(d.closed_at).getMonth() + 1; // 1-12
    const ex = monthData.get(month) ?? { deals_count: 0, revenue: 0 };
    ex.deals_count++;
    ex.revenue += d.value ?? 0;
    monthData.set(month, ex);
  }
  const peak_months = Array.from(monthData.entries())
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // ── RFM Score ──
  const rfm_recency = calcRecency(daysSinceLast);
  const rfm_frequency = calcFrequency(wonDeals.length);
  const rfm_monetary = calcMonetary(totalRevenue);

  // ── Churn Risk ──
  const churn_risk = calcChurnRisk(daysSinceLast, rfm_recency, rfm_frequency);

  return {
    contact_id: contactId,
    organization_id: orgId,
    avg_ticket: Math.round(avgTicket * 100) / 100,
    total_revenue: Math.round(totalRevenue * 100) / 100,
    deals_won_count: wonDeals.length,
    preferred_products,
    preferred_categories,
    peak_months,
    rfm_recency,
    rfm_frequency,
    rfm_monetary,
    churn_risk,
    days_since_last_purchase: daysSinceLast,
    last_purchase_date: lastPurchaseDate,
    last_computed_at: new Date().toISOString(),
  };
}

function calcRecency(days: number): number {
  if (days <= 30) return 5;
  if (days <= 90) return 4;
  if (days <= 180) return 3;
  if (days <= 365) return 2;
  return 1;
}

function calcFrequency(count: number): number {
  if (count >= 10) return 5;
  if (count >= 5) return 4;
  if (count >= 3) return 3;
  if (count >= 1) return 2;
  return 1;
}

function calcMonetary(revenue: number): number {
  if (revenue >= 50000) return 5;
  if (revenue >= 10000) return 4;
  if (revenue >= 3000) return 3;
  if (revenue >= 500) return 2;
  return 1;
}

function calcChurnRisk(days: number, recency: number, frequency: number): string {
  if (days > 365 || (recency === 1 && frequency === 1)) return "churned";
  if (days > 180 || recency <= 2) return "high";
  if (days > 90 || recency === 3) return "medium";
  return "low";
}
