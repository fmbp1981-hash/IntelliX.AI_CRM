/**
 * PATCH  /api/pipeline-triggers/[id] — atualiza trigger (actions, active, etc.)
 * DELETE /api/pipeline-triggers/[id] — remove trigger
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const patchSchema = z.object({
  trigger_event: z.enum(['on_enter', 'on_exit']).optional(),
  actions: z.array(z.object({
    type: z.enum(['send_email', 'send_whatsapp', 'create_activity', 'notify_team', 'add_tag']),
    config: z.record(z.unknown()),
  })).optional(),
  active: z.boolean().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = patchSchema.parse(await req.json())

    const { error } = await supabase
      .from('pipeline_triggers')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 })
    }
    console.error('[PATCH /api/pipeline-triggers/[id]]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const { error } = await supabase
      .from('pipeline_triggers')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/pipeline-triggers/[id]]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
