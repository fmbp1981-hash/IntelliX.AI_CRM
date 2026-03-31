/**
 * GET  /api/pipeline-triggers?board_id=xxx — lista triggers por board
 * POST /api/pipeline-triggers — cria novo trigger
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const triggerActionSchema = z.object({
  type: z.enum(['send_email', 'send_whatsapp', 'create_activity', 'notify_team', 'add_tag']),
  config: z.record(z.string(), z.unknown()),
})

const createSchema = z.object({
  board_id: z.string().uuid(),
  stage_id: z.string().uuid(),
  trigger_event: z.enum(['on_enter', 'on_exit']),
  actions: z.array(triggerActionSchema),
  active: z.boolean().optional(),
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

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const orgId = await getOrgId(supabase)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const boardId = searchParams.get('board_id')

    let query = supabase
      .from('pipeline_triggers')
      .select(`*, board_stages(label)`)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true })

    if (boardId) query = query.eq('board_id', boardId)

    const { data, error } = await query
    if (error) throw error

    const triggers = (data ?? []).map((row) => ({
      ...row,
      stage_label: (row.board_stages as { label: string } | null)?.label ?? null,
    }))

    return NextResponse.json(triggers)
  } catch (err) {
    console.error('[GET /api/pipeline-triggers]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const orgId = await getOrgId(supabase)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = createSchema.parse(await req.json())

    const { data, error } = await supabase
      .from('pipeline_triggers')
      .insert({ ...body, organization_id: orgId, active: body.active ?? true })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error('[POST /api/pipeline-triggers]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
