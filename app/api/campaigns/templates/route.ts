/**
 * @fileoverview API Route: Email Templates
 *
 * GET  /api/campaigns/templates — Lista templates da org
 * POST /api/campaigns/templates — Cria, atualiza, deleta ou gera via IA
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    getEmailTemplates,
    createEmailTemplate,
    updateEmailTemplate,
    deleteEmailTemplate,
    type CreateTemplatePayload,
} from '@/lib/supabase/email-campaigns';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export async function GET(_req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const templates = await getEmailTemplates(supabase, profile.organization_id);
        return NextResponse.json({ templates });
    } catch (error: any) {
        console.error('[campaigns/templates/GET]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const body = await req.json();
        const action = body.action as string;

        switch (action) {
            case 'create': {
                const payload = body as CreateTemplatePayload & { action: string };
                if (!payload.name || !payload.subject || !payload.html_body) {
                    return NextResponse.json({ error: 'name, subject e html_body são obrigatórios' }, { status: 400 });
                }
                const template = await createEmailTemplate(
                    supabase,
                    profile.organization_id,
                    user.id,
                    payload
                );
                return NextResponse.json({ template });
            }

            case 'update': {
                const { templateId, ...updates } = body;
                if (!templateId) return NextResponse.json({ error: 'templateId required' }, { status: 400 });
                const template = await updateEmailTemplate(supabase, templateId, updates);
                return NextResponse.json({ template });
            }

            case 'delete': {
                const { templateId: delId } = body;
                if (!delId) return NextResponse.json({ error: 'templateId required' }, { status: 400 });
                await deleteEmailTemplate(supabase, delId);
                return NextResponse.json({ success: true });
            }

            case 'generate_ai': {
                // Gera template de email com IA baseado no objetivo e público-alvo
                const { objective, targetSegment, tone, vertical, templateName } = body;
                if (!objective) return NextResponse.json({ error: 'objective required' }, { status: 400 });

                const systemPrompt = `Você é um especialista em email marketing B2B para o mercado brasileiro.
Gere emails persuasivos, diretos e com personalização via variáveis {{contact.name}}.
Sempre inclua a variável {{unsubscribe_url}} no rodapé.
Vertical de negócio: ${vertical ?? 'genérico'}.`;

                const userPrompt = `Crie um template de email com:
- Objetivo: ${objective}
- Público-alvo: ${targetSegment ?? 'clientes B2B'}
- Tom: ${tone ?? 'profissional e direto'}

Retorne SOMENTE um JSON válido com os campos:
{
  "subject": "Assunto do email",
  "subject_variants": ["Variante 1", "Variante 2"],
  "preview_text": "Texto de preview (max 90 chars)",
  "html_body": "HTML do email com {{contact.name}} e {{unsubscribe_url}}",
  "text_body": "Versão texto puro"
}`;

                const { text } = await generateText({
                    model: anthropic('claude-sonnet-4-6'),
                    system: systemPrompt,
                    prompt: userPrompt,
                    maxOutputTokens: 2000,
                });

                // Extrai JSON da resposta
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    return NextResponse.json({ error: 'IA não retornou JSON válido' }, { status: 500 });
                }

                const generated = JSON.parse(jsonMatch[0]);

                const template = await createEmailTemplate(
                    supabase,
                    profile.organization_id,
                    user.id,
                    {
                        name: templateName ?? `[IA] ${objective}`,
                        subject: generated.subject,
                        html_body: generated.html_body,
                        text_body: generated.text_body,
                        preview_text: generated.preview_text,
                        ai_generated: true,
                    }
                );

                return NextResponse.json({
                    template,
                    subject_variants: generated.subject_variants ?? [],
                });
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('[campaigns/templates/POST]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
