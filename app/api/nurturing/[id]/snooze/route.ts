/**
 * POST /api/nurturing/[id]/snooze — adia sugestão
 * Body: { until: ISO string }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const snoozeSchema = z.object({
  until: z.string().datetime(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { until } = snoozeSchema.parse(await req.json())

    const { error } = await supabase
      .from('nurturing_suggestions')
      .update({ status: 'snoozed', snoozed_until: until, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 })
    }
    console.error('[POST /api/nurturing/[id]/snooze]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
