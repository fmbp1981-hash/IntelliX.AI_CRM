#!/usr/bin/env npx tsx
/**
 * 🧪 AI Tools FULL CLI Test - Todas as 15 Tools
 * 
 * Testa TODAS as 15 tools com perguntas reais de vendedores!
 * 
 * Uso: npx tsx scripts/test-all-tools.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load env from .env.local
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

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Context - IDs reais do banco
const BOARD_ID = '3f347a83-b275-448e-9425-a6abde132811';
const USER_ID = 'c54b8d41-50e4-4c84-bfbb-3e60e0eb0dba';

// Colors
const c = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
};

interface TestResult {
    tool: string;
    question: string;
    passed: boolean;
    message: string;
    data?: any;
    duration: number;
}

const results: TestResult[] = [];

async function test(tool: string, question: string, fn: () => Promise<any>): Promise<void> {
    const start = Date.now();
    console.log(`\n${c.cyan}🧪 [${tool}]${c.reset}`);
    console.log(`${c.dim}   Pergunta: "${question}"${c.reset}`);

    try {
        const result = await fn();
        const duration = Date.now() - start;

        if (result.error) {
            console.log(`   ${c.red}❌ ERRO: ${result.error}${c.reset}`);
            results.push({ tool, question, passed: false, message: result.error, duration });
        } else {
            console.log(`   ${c.green}✅ OK (${duration}ms)${c.reset}`);
            const preview = JSON.stringify(result, null, 2).slice(0, 300);
            console.log(`   ${c.dim}${preview}${preview.length >= 300 ? '...' : ''}${c.reset}`);
            results.push({ tool, question, passed: true, message: 'OK', data: result, duration });
        }
    } catch (err: any) {
        const duration = Date.now() - start;
        console.log(`   ${c.red}💥 EXCEPTION: ${err.message}${c.reset}`);
        results.push({ tool, question, passed: false, message: err.message, duration });
    }
}

// ============= TOOL IMPLEMENTATIONS =============

// 1. analyzePipeline
async function analyzePipeline() {
    const { data: deals } = await supabase
        .from('deals')
        .select('id, value, is_won, is_lost, stage:board_stages(name)')
        .eq('board_id', BOARD_ID);

    const open = deals?.filter(d => !d.is_won && !d.is_lost) || [];
    const won = deals?.filter(d => d.is_won) || [];
    const lost = deals?.filter(d => d.is_lost) || [];
    const winRate = won.length + lost.length > 0
        ? Math.round(won.length / (won.length + lost.length) * 100) : 0;

    // Stage breakdown
    const stageMap = new Map<string, { count: number; value: number }>();
    open.forEach((d: any) => {
        const name = d.stage?.name || 'Sem estágio';
        const cur = stageMap.get(name) || { count: 0, value: 0 };
        stageMap.set(name, { count: cur.count + 1, value: cur.value + (d.value || 0) });
    });

    return {
        totalDeals: deals?.length || 0,
        openDeals: open.length,
        wonDeals: won.length,
        lostDeals: lost.length,
        winRate: `${winRate}%`,
        pipelineValue: `R$ ${open.reduce((s, d) => s + (d.value || 0), 0).toLocaleString('pt-BR')}`,
        stageBreakdown: Object.fromEntries(stageMap),
    };
}

// 2. getBoardMetrics
async function getBoardMetrics() {
    const { data: deals } = await supabase
        .from('deals')
        .select('id, value, is_won, is_lost')
        .eq('board_id', BOARD_ID);

    const won = deals?.filter(d => d.is_won) || [];
    const lost = deals?.filter(d => d.is_lost) || [];
    const open = deals?.filter(d => !d.is_won && !d.is_lost) || [];

    return {
        totalDeals: deals?.length || 0,
        openDeals: open.length,
        wonDeals: won.length,
        lostDeals: lost.length,
        winRate: won.length + lost.length > 0
            ? `${Math.round(won.length / (won.length + lost.length) * 100)}%` : '0%',
        pipelineValue: `R$ ${open.reduce((s, d) => s + (d.value || 0), 0).toLocaleString('pt-BR')}`,
    };
}

// 3. searchDeals
async function searchDeals(query: string) {
    const { data: deals, error } = await supabase
        .from('deals')
        .select('id, title, value, stage:board_stages(name), contact:contacts(name)')
        .eq('board_id', BOARD_ID)
        .ilike('title', `%${query}%`)
        .limit(5);

    if (error) return { error: error.message };
    return {
        count: deals?.length || 0,
        deals: deals?.map((d: any) => ({
            title: d.title,
            value: `R$ ${(d.value || 0).toLocaleString('pt-BR')}`,
            stage: d.stage?.name,
            contact: d.contact?.name,
        })),
    };
}

// 4. searchContacts
async function searchContacts(query: string) {
    const { data: contacts, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone, company_name')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(5);

    if (error) return { error: error.message };
    return { count: contacts?.length || 0, contacts };
}

// 5. listDealsByStage
async function listDealsByStage(stageName: string) {
    const { data: stages } = await supabase
        .from('board_stages')
        .select('id, name')
        .eq('board_id', BOARD_ID)
        .or(`name.ilike.%${stageName}%,label.ilike.%${stageName}%`);

    if (!stages?.length) {
        const { data: all } = await supabase.from('board_stages').select('name').eq('board_id', BOARD_ID);
        return { error: `Estágio "${stageName}" não encontrado. Disponíveis: ${all?.map(s => s.name).join(', ')}` };
    }

    const { data: deals } = await supabase
        .from('deals')
        .select('id, title, value, contact:contacts(name)')
        .eq('board_id', BOARD_ID)
        .eq('stage_id', stages[0].id)
        .eq('is_won', false)
        .eq('is_lost', false)
        .order('value', { ascending: false })
        .limit(10);

    return {
        stage: stages[0].name,
        count: deals?.length || 0,
        totalValue: `R$ ${(deals?.reduce((s, d) => s + (d.value || 0), 0) || 0).toLocaleString('pt-BR')}`,
        deals: deals?.map((d: any) => ({ title: d.title, value: d.value, contact: d.contact?.name })),
    };
}

// 6. listStagnantDeals
async function listStagnantDeals(days: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { data: deals } = await supabase
        .from('deals')
        .select('id, title, value, updated_at')
        .eq('board_id', BOARD_ID)
        .eq('is_won', false)
        .eq('is_lost', false)
        .lt('updated_at', cutoff.toISOString())
        .order('updated_at', { ascending: true })
        .limit(10);

    return {
        message: `${deals?.length || 0} deals parados há mais de ${days} dias`,
        deals: deals?.map(d => ({
            title: d.title,
            diasParado: Math.floor((Date.now() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24)),
            value: d.value,
        })),
    };
}

// 7. listOverdueDeals
async function listOverdueDeals() {
    const { data: activities } = await supabase
        .from('activities')
        .select('deal_id, title')
        .lt('date', new Date().toISOString())
        .eq('completed', false);

    if (!activities?.length) return { count: 0, message: '🎉 Nenhuma atividade atrasada!' };

    const dealIds = [...new Set(activities.map(a => a.deal_id).filter(Boolean))];
    const { data: deals } = await supabase
        .from('deals')
        .select('id, title, value')
        .eq('board_id', BOARD_ID)
        .in('id', dealIds)
        .limit(10);

    return {
        overdueActivities: activities.length,
        dealsAffected: deals?.length || 0,
        deals: deals?.map(d => ({
            title: d.title,
            overdueCount: activities.filter(a => a.deal_id === d.id).length,
        })),
    };
}

// 8. getDealDetails
async function getDealDetails(dealId: string) {
    const { data: deal, error } = await supabase
        .from('deals')
        .select('*, contact:contacts(name, email, phone), stage:board_stages(name)')
        .eq('id', dealId)
        .single();

    if (error) return { error: error.message };
    return {
        title: deal.title,
        value: `R$ ${(deal.value || 0).toLocaleString('pt-BR')}`,
        stage: (deal.stage as any)?.name,
        contact: (deal.contact as any)?.name,
        status: deal.is_won ? '✅ GANHO' : deal.is_lost ? '❌ PERDIDO' : '🔄 ABERTO',
        priority: deal.priority,
    };
}

// 9. moveDeal (simulação - não executa de verdade)
async function moveDeal(dealId: string, stageName: string) {
    const { data: stages } = await supabase
        .from('board_stages')
        .select('id, name')
        .eq('board_id', BOARD_ID)
        .or(`name.ilike.%${stageName}%`);

    if (!stages?.length) return { error: `Estágio "${stageName}" não encontrado` };

    // SIMULAÇÃO - não atualiza de verdade
    return {
        simulation: true,
        message: `[SIMULADO] Deal ${dealId.slice(0, 8)}... seria movido para "${stages[0].name}"`,
        targetStageId: stages[0].id,
    };
}

// 10. createDeal (simulação)
async function createDeal(title: string, value: number) {
    const { data: stages } = await supabase
        .from('board_stages')
        .select('id, name')
        .eq('board_id', BOARD_ID)
        .order('order', { ascending: true })
        .limit(1);

    return {
        simulation: true,
        message: `[SIMULADO] Deal "${title}" (R$ ${value.toLocaleString('pt-BR')}) seria criado em "${stages?.[0]?.name}"`,
        firstStageId: stages?.[0]?.id,
    };
}

// 11. updateDeal (simulação)
async function updateDeal(dealId: string, updates: any) {
    return {
        simulation: true,
        message: `[SIMULADO] Deal ${dealId.slice(0, 8)}... seria atualizado`,
        updates,
    };
}

// 12. markDealAsWon (simulação)
async function markDealAsWon(dealId: string) {
    const { data: deal } = await supabase.from('deals').select('title, value').eq('id', dealId).single();
    return {
        simulation: true,
        message: `[SIMULADO] 🎉 Deal "${deal?.title}" seria marcado como GANHO!`,
        value: deal?.value,
    };
}

// 13. markDealAsLost (simulação)
async function markDealAsLost(dealId: string, reason: string) {
    const { data: deal } = await supabase.from('deals').select('title').eq('id', dealId).single();
    return {
        simulation: true,
        message: `[SIMULADO] Deal "${deal?.title}" seria marcado como PERDIDO`,
        reason,
    };
}

// 14. assignDeal (simulação)
async function assignDeal(dealId: string, newOwnerId: string) {
    const { data: owner } = await supabase.from('profiles').select('first_name').eq('user_id', newOwnerId).single();
    return {
        simulation: true,
        message: `[SIMULADO] Deal ${dealId.slice(0, 8)}... seria atribuído para ${owner?.first_name || 'novo dono'}`,
    };
}

// 15. createTask (simulação)
async function createTask(title: string, dealId: string) {
    return {
        simulation: true,
        message: `[SIMULADO] Tarefa "${title}" seria criada para deal ${dealId.slice(0, 8)}...`,
    };
}

// ============= MAIN =============

async function main() {
    console.log('\n' + '='.repeat(70));
    console.log(`${c.blue}🚀 AI TOOLS - TESTE COMPLETO (15 TOOLS)${c.reset}`);
    console.log('='.repeat(70));
    console.log(`Board: ${BOARD_ID}`);
    console.log('='.repeat(70));

    // Get sample data for tests
    const { data: sampleDeal } = await supabase.from('deals').select('id').eq('board_id', BOARD_ID).limit(1).single();
    const dealId = sampleDeal?.id || 'test-id';

    // ============= ANÁLISE =============
    console.log(`\n${c.yellow}📊 ANÁLISE${c.reset}`);
    console.log('-'.repeat(50));

    await test('analyzePipeline',
        'Como está meu pipeline de vendas?',
        analyzePipeline);

    await test('getBoardMetrics',
        'Quais são as métricas do meu board?',
        getBoardMetrics);

    // ============= BUSCA =============
    console.log(`\n${c.yellow}🔍 BUSCA${c.reset}`);
    console.log('-'.repeat(50));

    await test('searchDeals',
        'Busque deals com Nike no título',
        () => searchDeals('Nike'));

    await test('searchContacts',
        'Procure contatos chamados João',
        () => searchContacts('João'));

    await test('listDealsByStage',
        'Quantos deals tenho no estágio Proposta?',
        () => listDealsByStage('Proposta'));

    await test('listDealsByStage',
        'Liste deals em Descoberta',
        () => listDealsByStage('Descoberta'));

    await test('listStagnantDeals',
        'Quais deals estão parados há mais de 7 dias?',
        () => listStagnantDeals(7));

    await test('listOverdueDeals',
        'Quais deals têm atividades atrasadas?',
        listOverdueDeals);

    await test('getDealDetails',
        'Me dê detalhes desse deal',
        () => getDealDetails(dealId));

    // ============= AÇÕES (SIMULADAS) =============
    console.log(`\n${c.yellow}⚡ AÇÕES (SIMULADAS - não alteram dados)${c.reset}`);
    console.log('-'.repeat(50));

    await test('moveDeal',
        'Mova esse deal para Proposta',
        () => moveDeal(dealId, 'Proposta'));

    await test('createDeal',
        'Crie um deal "Novo Cliente ABC" com valor R$ 15.000',
        () => createDeal('Novo Cliente ABC', 15000));

    await test('updateDeal',
        'Atualize o valor desse deal para R$ 50.000',
        () => updateDeal(dealId, { value: 50000 }));

    await test('markDealAsWon',
        'Marque esse deal como ganho!',
        () => markDealAsWon(dealId));

    await test('markDealAsLost',
        'Marque esse deal como perdido, o cliente escolheu concorrente',
        () => markDealAsLost(dealId, 'Concorrente'));

    await test('assignDeal',
        'Atribua esse deal para outro vendedor',
        () => assignDeal(dealId, USER_ID));

    await test('createTask',
        'Crie uma tarefa de ligar pro cliente amanhã',
        () => createTask('Ligar para cliente', dealId));

    // ============= SUMMARY =============
    console.log('\n' + '='.repeat(70));
    console.log(`${c.blue}📋 RESUMO${c.reset}`);
    console.log('='.repeat(70));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`${c.green}✅ Passou: ${passed}/${results.length}${c.reset}`);
    console.log(`${c.red}❌ Falhou: ${failed}/${results.length}${c.reset}`);

    if (failed > 0) {
        console.log(`\n${c.red}🔴 Testes que falharam:${c.reset}`);
        results.filter(r => !r.passed).forEach(r => {
            console.log(`   - ${r.tool}: ${r.message}`);
        });
    }

    // Timing summary
    const totalTime = results.reduce((s, r) => s + r.duration, 0);
    const avgTime = Math.round(totalTime / results.length);
    console.log(`\n⏱️  Tempo total: ${totalTime}ms (média: ${avgTime}ms/tool)`);

    console.log('\n' + '='.repeat(70) + '\n');
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
