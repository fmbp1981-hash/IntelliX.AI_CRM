import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { customerIntelligenceService } from '@/lib/supabase/customer-intelligence'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { contactId } = await params
    const profile = await customerIntelligenceService.getProfile(contactId)
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    return NextResponse.json(profile)
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
