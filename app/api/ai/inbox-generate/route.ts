/**
 * @fileoverview API Route: Inbox Action Items Generation
 * 
 * Gera action items inteligentes para o inbox do vendedor.
 * Usa análise heurística de deals estagnados e atividades vencidas.
 * 
 * POST /api/ai/inbox-generate
 * → Gera e persiste novos action items priorizados
 * 
 * @module app/api/ai/inbox-generate
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSmartActionItems, createActionItem } from '@/lib/supabase/inbox-actions';

export async function POST() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    try {
        // Gerar sugestões inteligentes
        const suggestions = await generateSmartActionItems(
            supabase,
            user.id,
            profile.organization_id
        );

        // Persistir os action items gerados
        const created: any[] = [];
        for (const suggestion of suggestions) {
            // Evitar duplicatas: não criar se já existe pending com mesmo deal_id e action_type
            if (suggestion.deal_id) {
                const { count } = await supabase
                    .from('inbox_action_items')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('deal_id', suggestion.deal_id)
                    .eq('action_type', suggestion.action_type)
                    .eq('status', 'pending');

                if (count && count > 0) continue;
            }

            const item = await createActionItem(
                supabase,
                user.id,
                profile.organization_id,
                suggestion
            );
            created.push(item);
        }

        return NextResponse.json({
            generated: created.length,
            items: created,
        });
    } catch (err: any) {
        console.error('[api/ai/inbox-generate] Error:', err);
        return NextResponse.json(
            { error: err?.message || 'Failed to generate actions' },
            { status: 500 }
        );
    }
}
