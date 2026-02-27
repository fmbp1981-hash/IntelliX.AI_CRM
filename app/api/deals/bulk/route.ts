/**
 * @fileoverview Bulk Operations API Route
 * 
 * Módulo 10 do PRD Complementar — Operações em Massa.
 * 
 * POST /api/deals/bulk
 * body: { dealIds: string[], operation: string, params: {} }
 * 
 * Ops suportadas: move_stage, assign, add_tag, remove_tag, delete, export_csv
 * Limite: 100 deals por requisição.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type BulkOperation =
    | 'move_stage'
    | 'assign'
    | 'add_tag'
    | 'remove_tag'
    | 'delete'
    | 'export_csv';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const body = await req.json();
        const { dealIds, operation, params } = body as {
            dealIds: string[];
            operation: BulkOperation;
            params?: Record<string, any>;
        };

        // Validation
        if (!Array.isArray(dealIds) || dealIds.length === 0) {
            return NextResponse.json({ error: 'dealIds is required (non-empty array)' }, { status: 400 });
        }
        if (dealIds.length > 100) {
            return NextResponse.json({ error: 'Maximum 100 deals per request' }, { status: 400 });
        }
        if (!operation) {
            return NextResponse.json({ error: 'operation is required' }, { status: 400 });
        }

        let result: { affected: number; data?: any };

        switch (operation) {
            case 'move_stage': {
                if (!params?.stage_id) {
                    return NextResponse.json({ error: 'params.stage_id required' }, { status: 400 });
                }
                const { data, error } = await supabase
                    .from('deals')
                    .update({ stage_id: params.stage_id, updated_at: new Date().toISOString() })
                    .in('id', dealIds)
                    .eq('organization_id', profile.organization_id)
                    .select('id');

                if (error) throw error;
                result = { affected: data?.length || 0 };
                break;
            }

            case 'assign': {
                if (!params?.owner_id) {
                    return NextResponse.json({ error: 'params.owner_id required' }, { status: 400 });
                }
                const { data, error } = await supabase
                    .from('deals')
                    .update({ owner_id: params.owner_id, updated_at: new Date().toISOString() })
                    .in('id', dealIds)
                    .eq('organization_id', profile.organization_id)
                    .select('id');

                if (error) throw error;
                result = { affected: data?.length || 0 };
                break;
            }

            case 'add_tag': {
                if (!params?.tag_id) {
                    return NextResponse.json({ error: 'params.tag_id required' }, { status: 400 });
                }
                const inserts = dealIds.map(dealId => ({
                    deal_id: dealId,
                    tag_id: params.tag_id,
                }));

                const { error } = await supabase
                    .from('deal_tags')
                    .upsert(inserts, { onConflict: 'deal_id,tag_id', ignoreDuplicates: true });

                if (error) throw error;
                result = { affected: inserts.length };
                break;
            }

            case 'remove_tag': {
                if (!params?.tag_id) {
                    return NextResponse.json({ error: 'params.tag_id required' }, { status: 400 });
                }
                const { data, error } = await supabase
                    .from('deal_tags')
                    .delete()
                    .in('deal_id', dealIds)
                    .eq('tag_id', params.tag_id)
                    .select('deal_id');

                if (error) throw error;
                result = { affected: data?.length || 0 };
                break;
            }

            case 'delete': {
                // Admin only
                if (profile.role !== 'admin') {
                    return NextResponse.json({ error: 'Only admins can bulk delete' }, { status: 403 });
                }
                const { data, error } = await supabase
                    .from('deals')
                    .delete()
                    .in('id', dealIds)
                    .eq('organization_id', profile.organization_id)
                    .select('id');

                if (error) throw error;
                result = { affected: data?.length || 0 };
                break;
            }

            case 'export_csv': {
                const { data: deals, error } = await supabase
                    .from('deals')
                    .select(`
            id, title, value, status, 
            stage:board_stages(name), 
            contact:contacts(name, email, phone),
            owner:profiles!deals_owner_id_fkey(full_name),
            created_at, updated_at
          `)
                    .in('id', dealIds)
                    .eq('organization_id', profile.organization_id);

                if (error) throw error;

                // Generate CSV
                const headers = ['ID', 'Título', 'Valor', 'Status', 'Estágio', 'Contato', 'Email', 'Telefone', 'Responsável', 'Criado', 'Atualizado'];
                const rows = (deals || []).map((d: any) => [
                    d.id,
                    d.title,
                    d.value || 0,
                    d.status,
                    d.stage?.name || '',
                    d.contact?.name || '',
                    d.contact?.email || '',
                    d.contact?.phone || '',
                    d.owner?.full_name || '',
                    d.created_at,
                    d.updated_at,
                ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));

                const csv = [headers.join(','), ...rows].join('\n');

                return new NextResponse(csv, {
                    headers: {
                        'Content-Type': 'text/csv',
                        'Content-Disposition': `attachment; filename="deals_export_${Date.now()}.csv"`,
                    },
                });
            }

            default:
                return NextResponse.json(
                    { error: `Unsupported operation: ${operation}` },
                    { status: 400 }
                );
        }

        return NextResponse.json({
            success: true,
            operation,
            ...result,
        });
    } catch (error: any) {
        console.error('[deals/bulk/POST]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
