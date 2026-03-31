/**
 * GET /api/agent/methodology-templates
 * Lista templates de metodologia disponíveis.
 * Filtros opcionais: ?vertical=medical_clinic&role=closer
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listMethodologyTemplates } from '@/lib/supabase/agent-methodology';

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(req.url);

        const vertical = searchParams.get('vertical');
        const agent_role = searchParams.get('role') ?? undefined;

        const templates = await listMethodologyTemplates(supabase, {
            vertical: vertical ?? undefined,
            agent_role,
        });

        return NextResponse.json({ templates });
    } catch (err) {
        console.error('[methodology-templates] GET error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
