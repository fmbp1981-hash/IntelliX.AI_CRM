/**
 * @fileoverview API Route: Unsubscribe (pública, sem autenticação)
 *
 * GET /api/unsubscribe/[token]
 *
 * Token = base64 de "organizationId:email"
 * Registra o descadastramento e retorna HTML de confirmação.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        let organizationId: string;
        let email: string;

        try {
            const decoded = atob(token);
            [organizationId, email] = decoded.split(':');
        } catch {
            return new NextResponse(buildHtml('Link inválido.', false), {
                headers: { 'Content-Type': 'text/html' },
                status: 400,
            });
        }

        if (!organizationId || !email) {
            return new NextResponse(buildHtml('Link inválido.', false), {
                headers: { 'Content-Type': 'text/html' },
                status: 400,
            });
        }

        const supabase = await createClient();

        // Upsert: idempotente (já descadastrado → não falha)
        await supabase
            .from('email_unsubscribes')
            .upsert(
                { organization_id: organizationId, email, reason: 'user_request' },
                { onConflict: 'organization_id,email', ignoreDuplicates: true }
            );

        return new NextResponse(buildHtml(`O email <strong>${email}</strong> foi removido da nossa lista.`, true), {
            headers: { 'Content-Type': 'text/html' },
            status: 200,
        });
    } catch (error: any) {
        console.error('[unsubscribe/GET]', error);
        return new NextResponse(buildHtml('Erro ao processar. Tente novamente.', false), {
            headers: { 'Content-Type': 'text/html' },
            status: 500,
        });
    }
}

function buildHtml(message: string, success: boolean): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Descadastramento</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: white; border-radius: 16px; padding: 48px 40px; max-width: 480px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,0.06); text-align: center; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 22px; color: #1e293b; margin-bottom: 12px; }
    p { color: #64748b; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? '✅' : '❌'}</div>
    <h1>${success ? 'Descadastramento confirmado' : 'Algo deu errado'}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
