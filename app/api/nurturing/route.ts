/**
 * GET  /api/nurturing?status=pending&urgency=high&limit=20
 * POST /api/nurturing — create suggestion (admin/engine use)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { NurturingStatus } from '@/types/customer-intelligence'

export const dynamic = 'force-dynamic'

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  return data?.organization_id ?? null
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const orgId = await getOrgId(supabase)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as NurturingStatus | null
    const urgency = searchParams.get('urgency')
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 50

    let query = supabase
      .from('nurturing_suggestions')
      .select(`
        *,
        contacts!inner(name, phone),
        deals(title)
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) query = query.eq('status', status)
    if (urgency) query = query.eq('urgency', urgency)

    const { data, error } = await query
    if (error) throw error

    const suggestions = (data ?? []).map((row) => ({
      ...row,
      contact_name: (row.contacts as { name: string } | null)?.name ?? null,
      contact_phone: (row.contacts as { phone: string } | null)?.phone ?? null,
      deal_title: (row.deals as { title: string } | null)?.title ?? null,
    }))

    return NextResponse.json(suggestions)
  } catch (err) {
    console.error('[GET /api/nurturing]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
