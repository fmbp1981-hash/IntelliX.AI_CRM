/**
 * POST /api/nurturing/[id]/approve — aprova sugestão (muda status para 'approved')
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const { error } = await supabase
      .from('nurturing_suggestions')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/nurturing/[id]/approve]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
