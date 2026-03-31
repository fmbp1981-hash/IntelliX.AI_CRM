/**
 * GET  /api/nurturing/settings — retorna config de auto-nurturing da org
 * PATCH /api/nurturing/settings — atualiza nurturing_auto_mode e nurturing_max_auto_per_day
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const settingsSchema = z.object({
  nurturing_auto_mode: z.boolean().optional(),
  nurturing_max_auto_per_day: z.number().int().min(0).max(10).optional(),
})

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

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const orgId = await getOrgId(supabase)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('organizations')
      .select('nurturing_auto_mode, nurturing_max_auto_per_day')
      .eq('id', orgId)
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/nurturing/settings]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const orgId = await getOrgId(supabase)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = settingsSchema.parse(await req.json())

    const { error } = await supabase
      .from('organizations')
      .update(body)
      .eq('id', orgId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 })
    }
    console.error('[PATCH /api/nurturing/settings]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
