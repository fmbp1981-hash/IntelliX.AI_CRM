#!/usr/bin/env npx tsx
/**
 * 🧪 Simulação de Conversa de Vendedor
 * 
 * Testa a sequência exata que o usuário fez:
 * 1. "quantos deals em proposta?"
 * 2. (IA responde 1 deal)
 * 3. "marque ele como ganho"
 * 4. (IA precisa encontrar o deal e marcar)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load env
try {
    const envPath = join(process.cwd(), '.env.local');
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match && !process.env[match[1]]) {
            process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
    });
} catch { }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BOARD_ID = '3f347a83-b275-448e-9425-a6abde132811';

const c = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
    bold: '\x1b[1m',
};

console.log('\n' + '='.repeat(70));
console.log(`${c.blue}${c.bold}🎭 SIMULAÇÃO DE CONVERSA DE VENDEDOR${c.reset}`);
console.log('='.repeat(70) + '\n');

// ============= STEP 1: "Quantos deals em proposta?" =============

console.log(`${c.yellow}👤 Vendedor: "Quantos deals tenho em proposta?"${c.reset}\n`);

async function step1_listDealsByStage() {
    const stageName = 'Proposta';

    console.log(`${c.dim}[Tool: listDealsByStage]${c.reset}`);
    console.log(`${c.dim}   stageName: "${stageName}"${c.reset}`);
    console.log(`${c.dim}   boardId: "${BOARD_ID}"${c.reset}\n`);

    // Find stage
    const { data: stages, error: stageError } = await supabase
        .from('board_stages')
        .select('id, name')
        .eq('board_id', BOARD_ID)
        .or(`name.ilike.%${stageName}%,label.ilike.%${stageName}%`);

    if (stageError) {
        console.log(`${c.red}❌ Erro ao buscar stage: ${stageError.message}${c.reset}`);
        return null;
    }

    if (!stages?.length) {
        console.log(`${c.red}❌ Estágio "${stageName}" não encontrado${c.reset}`);
        return null;
    }

    const stageId = stages[0].id;
    console.log(`${c.dim}   Stage encontrado: ${stages[0].name} (${stageId.slice(0, 8)}...)${c.reset}`);

    // Find deals in stage
    const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('id, title, value, contact:contacts(name)')
        .eq('board_id', BOARD_ID)
        .eq('stage_id', stageId)
        .eq('is_won', false)
        .eq('is_lost', false)
        .order('value', { ascending: false })
        .limit(10);

    if (dealsError) {
        console.log(`${c.red}❌ Erro ao buscar deals: ${dealsError.message}${c.reset}`);
        return null;
    }

    const totalValue = deals?.reduce((s, d) => s + (d.value || 0), 0) || 0;

    console.log(`${c.green}✅ Resultado:${c.reset}`);
    console.log(`   Stage: ${stages[0].name}`);
    console.log(`   Deals: ${deals?.length || 0}`);
    console.log(`   Valor Total: R$ ${totalValue.toLocaleString('pt-BR')}`);

    if (deals && deals.length > 0) {
        console.log(`   Deals encontrados:`);
        deals.forEach((d: any) => {
            console.log(`     - ${d.title} (R$ ${(d.value || 0).toLocaleString('pt-BR')}) - ${d.contact?.name || 'Sem contato'}`);
        });
    }

    return deals;
}

// ============= STEP 2: "Marque o deal de proposta como ganho" =============

async function step2_markDealAsWon(stageName: string) {
    console.log(`\n${c.yellow}👤 Vendedor: "Marque o deal que está em proposta como ganho"${c.reset}\n`);

    console.log(`${c.dim}[Tool: markDealAsWon]${c.reset}`);
    console.log(`${c.dim}   stageName: "${stageName}"${c.reset}`);
    console.log(`${c.dim}   boardId: "${BOARD_ID}"${c.reset}\n`);

    // Smart lookup by stage
    const { data: foundDeals, error } = await supabase
        .from('deals')
        .select('id, title, value, stage:board_stages(name)')
        .eq('board_id', BOARD_ID)
        .eq('is_won', false)
        .eq('is_lost', false)
        .limit(20);

    if (error) {
        console.log(`${c.red}❌ Erro ao buscar deals: ${error.message}${c.reset}`);
        return false;
    }

    console.log(`${c.dim}   Deals abertos encontrados: ${foundDeals?.length || 0}${c.reset}`);

    // Filter by stage name
    const filtered = foundDeals?.filter((d: any) =>
        d.stage?.name?.toLowerCase().includes(stageName.toLowerCase())
    ) || [];

    console.log(`${c.dim}   Deals em "${stageName}": ${filtered.length}${c.reset}`);

    if (filtered.length === 0) {
        console.log(`${c.red}❌ Nenhum deal encontrado em "${stageName}"${c.reset}`);

        // Debug: show what stages deals are in
        const stageGroups = new Map<string, number>();
        foundDeals?.forEach((d: any) => {
            const sn = d.stage?.name || 'Sem estágio';
            stageGroups.set(sn, (stageGroups.get(sn) || 0) + 1);
        });
        console.log(`${c.dim}   Deals por estágio:${c.reset}`);
        stageGroups.forEach((count, name) => {
            console.log(`${c.dim}     - ${name}: ${count}${c.reset}`);
        });

        return false;
    }

    if (filtered.length === 1) {
        const deal = filtered[0];
        console.log(`${c.green}✅ Encontrado 1 deal em ${stageName}:${c.reset}`);
        console.log(`   ID: ${deal.id}`);
        console.log(`   Título: ${deal.title}`);
        console.log(`   Valor: R$ ${(deal.value || 0).toLocaleString('pt-BR')}`);

        // SIMULAÇÃO - não marca de verdade
        console.log(`\n${c.yellow}⚠️  [SIMULAÇÃO] Não vou marcar como ganho de verdade para não alterar dados.${c.reset}`);
        console.log(`${c.green}   Se fosse real, executaria: UPDATE deals SET is_won=true WHERE id='${deal.id}'${c.reset}`);

        return true;
    } else {
        console.log(`${c.yellow}⚠️  Encontrei ${filtered.length} deals em "${stageName}". Especifique qual:${c.reset}`);
        filtered.forEach((d: any) => {
            console.log(`   - ${d.title} (R$ ${(d.value || 0).toLocaleString('pt-BR')})`);
        });
        return false;
    }
}

// ============= RUN CONVERSATION =============

async function main() {
    try {
        // Step 1
        const deals = await step1_listDealsByStage();

        if (!deals || deals.length === 0) {
            console.log(`\n${c.red}❌ FALHA: Não encontrou deals em Proposta${c.reset}`);
            process.exit(1);
        }

        // Step 2
        const success = await step2_markDealAsWon('Proposta');

        console.log('\n' + '='.repeat(70));
        if (success) {
            console.log(`${c.green}${c.bold}✅ CONVERSA SIMULADA COM SUCESSO!${c.reset}`);
            console.log(`${c.dim}A IA conseguiria encontrar e marcar o deal corretamente.${c.reset}`);
        } else {
            console.log(`${c.red}${c.bold}❌ FALHA NA SIMULAÇÃO${c.reset}`);
        }
        console.log('='.repeat(70) + '\n');

        process.exit(success ? 0 : 1);
    } catch (err: any) {
        console.log(`${c.red}💥 ERRO: ${err.message}${c.reset}`);
        process.exit(1);
    }
}

main();
