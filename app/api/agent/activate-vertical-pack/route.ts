/**
 * POST /api/agent/activate-vertical-pack
 *
 * Ativa um pack de metodologia para uma vertical específica.
 * Para cada boardId fornecido, cria/atualiza um agent_board_config
 * com o template mais adequado da vertical. Também aplica
 * personalizações padrão (tom, regras de negócio) no agent_configs global.
 *
 * Body: {
 *   vertical: 'generic' | 'medical_clinic' | 'dental_clinic' | 'real_estate';
 *   boardIds: string[];           // boards a configurar
 *   overwrite?: boolean;          // sobrescrever configs existentes (default: false)
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Vertical = 'generic' | 'medical_clinic' | 'dental_clinic' | 'real_estate';

// Default tone/personalization per vertical
const VERTICAL_DEFAULTS: Record<Vertical, {
    tone_preset: string;
    words_to_avoid: string[];
    important_rules: string[];
    do_list: string[];
    dont_list: string[];
    escalation_triggers: string[];
}> = {
    generic: {
        tone_preset: 'profissional',
        words_to_avoid: ['problema', 'impossível', 'não posso'],
        important_rules: ['Nunca prometa prazos sem verificar no CRM'],
        do_list: ['Confirmar nome do lead antes de avançar', 'Usar ferramenta search_knowledge antes de citar preços'],
        dont_list: ['Revelar dados de outros clientes', 'Prometer descontos sem aprovação'],
        escalation_triggers: ['Lead demonstra raiva ou frustração', 'Lead pede falar com gerente', 'Situação jurídica mencionada'],
    },
    medical_clinic: {
        tone_preset: 'empático',
        words_to_avoid: ['barato', 'caro', 'problema grave', 'urgência'],
        important_rules: [
            'NUNCA diagnosticar, prescrever ou opinar sobre condições médicas',
            'Em caso de emergência, orientar procurar pronto-socorro imediatamente',
            'Nunca garantir resultados de procedimentos',
        ],
        do_list: [
            'Usar linguagem acolhedora e empática',
            'Sempre sugerir agendamento de consulta para avaliação',
            'Confirmar convênio/plano antes de citar valores',
        ],
        dont_list: [
            'Diagnosticar ou opinar sobre sintomas',
            'Citar preços sem verificar convênio',
            'Garantir cura ou resultado de tratamento',
        ],
        escalation_triggers: [
            'Paciente relata dor aguda ou emergência',
            'Menção de medicamentos controlados',
            'Reclamação sobre procedimento anterior',
        ],
    },
    dental_clinic: {
        tone_preset: 'empático',
        words_to_avoid: ['dói muito', 'grave', 'arrancar', 'problema'],
        important_rules: [
            'NUNCA diagnosticar condições dentárias por WhatsApp',
            'Nunca garantir resultado estético sem avaliação presencial',
            'Em caso de dor aguda, orientar procurar atendimento de urgência',
        ],
        do_list: [
            'Tranquilizar pacientes com ansiedade dentária',
            'Explicar procedimentos de forma simples e sem termos técnicos',
            'Sempre confirmar orçamento com avaliação presencial',
        ],
        dont_list: [
            'Diagnosticar cáries, periodontite ou outras condições remotamente',
            'Garantir preço final de tratamento sem avaliação',
            'Usar termos técnicos que causem medo',
        ],
        escalation_triggers: [
            'Paciente relata dor intensa ou inchaço',
            'Reclamação sobre procedimento anterior',
            'Pedido de reembolso ou nota fiscal',
        ],
    },
    real_estate: {
        tone_preset: 'consultivo',
        words_to_avoid: ['bagunça', 'problema', 'ruim', 'longe demais'],
        important_rules: [
            'Nunca garantir aprovação de financiamento',
            'Nunca citar comissão',
            'Confirmar disponibilidade do imóvel antes de agendar visita',
        ],
        do_list: [
            'Qualificar perfil antes de sugerir imóveis: compra/aluguel, tipo, região, faixa de valor',
            'Destacar pontos positivos do bairro (segurança, infraestrutura)',
            'Agendar visita apenas após confirmação com corretor titular',
        ],
        dont_list: [
            'Mencionar proprietário ou endereço exato sem autorização',
            'Citar comissão ou honorários',
            'Garantir aprovação de crédito ou financiamento',
        ],
        escalation_triggers: [
            'Lead pergunta sobre aspectos jurídicos do contrato',
            'Contestação de documentação',
            'Lead já tem proposta de outra imobiliária',
        ],
    },
};

// Template name → agent_role mapping per vertical
const VERTICAL_TEMPLATE_ROLES: Record<Vertical, string[]> = {
    generic: ['sdr', 'closer', 'reactivation'],
    medical_clinic: ['reception', 'conversion', 'no_show_recovery'],
    dental_clinic: ['reception', 'ortho_closer', 'no_show_recovery'],
    real_estate: ['lead_qualification', 'negotiation', 'reactivation'],
};

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();
    return data?.organization_id ?? null;
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const orgId = await getOrgId(supabase);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { vertical, boardIds, overwrite = false } = body as {
            vertical: Vertical;
            boardIds: string[];
            overwrite: boolean;
        };

        if (!vertical || !boardIds?.length) {
            return NextResponse.json({ error: 'vertical and boardIds are required' }, { status: 400 });
        }

        const defaults = VERTICAL_DEFAULTS[vertical];
        if (!defaults) {
            return NextResponse.json({ error: `Unknown vertical: ${vertical}` }, { status: 400 });
        }

        // 1. Fetch available templates for this vertical (includes generic templates with null vertical)
        const { data: templates } = await supabase
            .from('agent_methodology_templates')
            .select('id, name, agent_role, vertical, sort_order')
            .eq('is_active', true)
            .or(`vertical.is.null,vertical.eq.${vertical}`)
            .order('sort_order', { ascending: true });

        const availableTemplates = templates ?? [];

        // 2. Find best template for the first/primary role of this vertical
        const primaryRole = VERTICAL_TEMPLATE_ROLES[vertical][0];
        const primaryTemplate = availableTemplates.find(
            (t) => t.agent_role === primaryRole && (t.vertical === vertical || t.vertical === null)
        ) ?? availableTemplates[0] ?? null;

        // 3. Upsert board configs for all selected boards
        const boardResults: Array<{ board_id: string; status: string; template_id: string | null }> = [];

        for (const boardId of boardIds) {
            // Check if config already exists
            const { data: existing } = await supabase
                .from('agent_board_configs')
                .select('id')
                .eq('organization_id', orgId)
                .eq('board_id', boardId)
                .single();

            if (existing && !overwrite) {
                boardResults.push({ board_id: boardId, status: 'skipped_existing', template_id: null });
                continue;
            }

            const { error } = await supabase
                .from('agent_board_configs')
                .upsert(
                    {
                        organization_id: orgId,
                        board_id: boardId,
                        agent_mode: 'template',
                        methodology_template_id: primaryTemplate?.id ?? null,
                        agent_role: primaryRole,
                        is_active: true,
                    },
                    { onConflict: 'organization_id,board_id' }
                );

            boardResults.push({
                board_id: boardId,
                status: error ? 'error' : 'configured',
                template_id: primaryTemplate?.id ?? null,
            });
        }

        // 4. Apply vertical personalization defaults to agent_configs global
        const { error: personalizationError } = await supabase
            .from('agent_configs')
            .update({
                tone_of_voice: {
                    preset: defaults.tone_preset,
                    language_style: {
                        formality: vertical === 'real_estate' ? 'formal' : 'neutro',
                        energy: 'moderado',
                        empathy_level: ['medical_clinic', 'dental_clinic'].includes(vertical) ? 'alta' : 'média',
                        use_emojis: true,
                    },
                    words_to_use: [],
                    words_to_avoid: defaults.words_to_avoid,
                    few_shot_examples: [],
                },
                behavioral_training: {
                    do_list: defaults.do_list,
                    dont_list: defaults.dont_list,
                    escalation_triggers: defaults.escalation_triggers,
                    conversation_starters: [],
                    success_stories: [],
                },
                business_context_extended: {
                    key_products_services: [],
                    unique_value_propositions: [],
                    competitors: [],
                    important_rules: defaults.important_rules,
                },
            })
            .eq('organization_id', orgId);

        return NextResponse.json({
            success: true,
            vertical,
            boards_configured: boardResults,
            personalization_applied: !personalizationError,
            available_templates: availableTemplates.map((t) => ({
                id: t.id,
                name: t.name,
                agent_role: t.agent_role,
            })),
        });
    } catch (err) {
        console.error('[activate-vertical-pack] POST error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
