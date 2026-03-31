import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { customerIntelligenceService } from '@/lib/supabase/customer-intelligence'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const churnRisk = searchParams.get('churn_risk') ?? undefined
    const minRfm = searchParams.get('min_rfm') ? Number(searchParams.get('min_rfm')) : undefined
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 50

    const profiles = await customerIntelligenceService.listProfiles({ churn_risk: churnRisk, min_rfm: minRfm, limit })
    return NextResponse.json(profiles)
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
