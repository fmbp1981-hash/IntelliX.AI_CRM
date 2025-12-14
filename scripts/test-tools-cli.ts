#!/usr/bin/env npx tsx
/**
 * 🧪 AI Tools CLI Test Script
 * 
 * Testa TODAS as 15 tools diretamente no terminal, sem precisar de browser!
 * Usa Supabase direto com service role key.
 * 
 * Uso: 
 *   npx tsx scripts/test-tools-cli.ts
 * 
 *   Ou com env vars explícitas:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/test-tools-cli.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Try to load env from .env.local if exists
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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test context - IDs reais do banco
const BOARD_ID = '3f347a83-b275-448e-9425-a6abde132811';
const TEST_USER_ID = 'c54b8d41-50e4-4c84-bfbb-3e60e0eb0dba';

// Colors for terminal
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

const log = {
    success: (msg: string) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg: string) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    warn: (msg: string) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    info: (msg: string) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
    test: (msg: string) => console.log(`${colors.cyan}🧪 ${msg}${colors.reset}`),
};

interface TestResult {
    name: string;
    passed: boolean;
    message: string;
    data?: any;
    duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<any>): Promise<void> {
    const start = Date.now();
    log.test(`Testing: ${name}`);

    try {
        const result = await fn();
        const duration = Date.now() - start;

        if (result.error) {
            log.error(`FAILED: ${result.error}`);
            results.push({ name, passed: false, message: result.error, duration });
        } else {
            log.success(`PASSED (${duration}ms)`);
            console.log('   Result:', JSON.stringify(result, null, 2).slice(0, 300));
            results.push({ name, passed: true, message: 'OK', data: result, duration });
        }
    } catch (err: any) {
        const duration = Date.now() - start;
        log.error(`ERROR: ${err.message}`);
        results.push({ name, passed: false, message: err.message, duration });
    }
    console.log('');
}

// ============= TOOL SIMULATIONS =============

async function testAnalyzePipeline() {
    const { data: deals } = await supabase
        .from('deals')
        .select('id, title, value, is_won, is_lost, stage:board_stages(name, label)')
        .eq('board_id', BOARD_ID);

    const openDeals = deals?.filter(d => !d.is_won && !d.is_lost) || [];
    const wonDeals = deals?.filter(d => d.is_won) || [];
    const lostDeals = deals?.filter(d => d.is_lost) || [];

    const totalValue = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    const winRate = wonDeals.length + lostDeals.length > 0
        ? Math.round(wonDeals.length / (wonDeals.length + lostDeals.length) * 100)
        : 0;

    return {
        totalDeals: deals?.length || 0,
        openDeals: openDeals.length,
        wonDeals: wonDeals.length,
        lostDeals: lostDeals.length,
        winRate: `${winRate}%`,
        pipelineValue: `R$ ${totalValue.toLocaleString('pt-BR')}`,
    };
}

async function testGetBoardMetrics() {
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
        winRate: won.length + lost.length > 0 ? `${Math.round(won.length / (won.length + lost.length) * 100)}%` : '0%',
    };
}

async function testSearchDeals(query: string) {
    const { data: deals, error } = await supabase
        .from('deals')
        .select('id, title, value, is_won, is_lost')
        .eq('board_id', BOARD_ID)
        .ilike('title', `%${query}%`)
        .limit(5);

    if (error) return { error: error.message };
    return { count: deals?.length || 0, deals: deals?.map(d => ({ id: d.id, title: d.title, value: d.value })) };
}

async function testListDealsByStage(stageName: string) {
    // Step 1: Find stage
    const { data: stages, error: stageError } = await supabase
        .from('board_stages')
        .select('id, name, label')
        .eq('board_id', BOARD_ID)
        .or(`name.ilike.%${stageName}%,label.ilike.%${stageName}%`);

    if (stageError) return { error: stageError.message };
    if (!stages || stages.length === 0) {
        const { data: allStages } = await supabase.from('board_stages').select('name').eq('board_id', BOARD_ID);
        return { error: `Stage "${stageName}" not found. Available: ${allStages?.map(s => s.name).join(', ')}` };
    }

    const stageId = stages[0].id;
    console.log(`   Found stage: ${stages[0].name} (${stageId})`);

    // Step 2: Find deals in that stage
    const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('id, title, value, contact:contacts(name)')
        .eq('board_id', BOARD_ID)
        .eq('stage_id', stageId)
        .eq('is_won', false)
        .eq('is_lost', false)
        .order('value', { ascending: false })
        .limit(10);

    if (dealsError) return { error: dealsError.message };

    return {
        stage: stages[0].name,
        count: deals?.length || 0,
        deals: deals?.map((d: any) => ({ id: d.id, title: d.title, value: d.value, contact: d.contact?.name })),
    };
}

async function testListStagnantDeals(daysStagnant: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysStagnant);

    const { data: deals, error } = await supabase
        .from('deals')
        .select('id, title, value, updated_at')
        .eq('board_id', BOARD_ID)
        .eq('is_won', false)
        .eq('is_lost', false)
        .lt('updated_at', cutoffDate.toISOString())
        .order('updated_at', { ascending: true })
        .limit(10);

    if (error) return { error: error.message };

    return {
        daysStagnant,
        count: deals?.length || 0,
        deals: deals?.map(d => {
            const days = Math.floor((Date.now() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24));
            return { id: d.id, title: d.title, value: d.value, daysStagnant: days };
        }),
    };
}

async function testListOverdueDeals() {
    const now = new Date().toISOString();

    const { data: overdueActivities, error: actError } = await supabase
        .from('activities')
        .select('deal_id, date, title')
        .lt('date', now)
        .eq('completed', false)
        .order('date', { ascending: true });

    if (actError) return { error: actError.message };
    if (!overdueActivities || overdueActivities.length === 0) {
        return { count: 0, message: 'No overdue activities! 🎉', deals: [] };
    }

    const dealIds = [...new Set(overdueActivities.map(a => a.deal_id).filter(Boolean))];

    const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('id, title, value')
        .eq('board_id', BOARD_ID)
        .in('id', dealIds)
        .limit(10);

    if (dealsError) return { error: dealsError.message };

    return {
        overdueActivitiesCount: overdueActivities.length,
        dealsWithOverdue: deals?.length || 0,
        deals: deals?.map(d => ({
            id: d.id,
            title: d.title,
            overdueCount: overdueActivities.filter(a => a.deal_id === d.id).length,
        })),
    };
}

async function testSearchContacts(query: string) {
    const { data: contacts, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(5);

    if (error) return { error: error.message };
    return { count: contacts?.length || 0, contacts };
}

async function testGetDealDetails(dealId: string) {
    const { data: deal, error } = await supabase
        .from('deals')
        .select(`*, contact:contacts(name, email), stage:board_stages(name)`)
        .eq('id', dealId)
        .single();

    if (error) return { error: error.message };
    return {
        id: deal.id,
        title: deal.title,
        value: deal.value,
        stage: (deal.stage as any)?.name,
        contact: (deal.contact as any)?.name,
        status: deal.is_won ? 'WON' : deal.is_lost ? 'LOST' : 'OPEN',
    };
}

// ============= MAIN =============

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 AI TOOLS CLI TEST SUITE');
    console.log('='.repeat(60));
    console.log(`Board ID: ${BOARD_ID}`);
    console.log(`Supabase URL: ${supabaseUrl}`);
    console.log('='.repeat(60) + '\n');

    // ANÁLISE
    console.log('📊 ANÁLISE TOOLS');
    console.log('-'.repeat(40));
    await runTest('analyzePipeline', testAnalyzePipeline);
    await runTest('getBoardMetrics', testGetBoardMetrics);

    // BUSCA
    console.log('🔍 BUSCA TOOLS');
    console.log('-'.repeat(40));
    await runTest('searchDeals("Nike")', () => testSearchDeals('Nike'));
    await runTest('searchContacts("João")', () => testSearchContacts('João'));
    await runTest('listDealsByStage("Proposta")', () => testListDealsByStage('Proposta'));
    await runTest('listDealsByStage("Descoberta")', () => testListDealsByStage('Descoberta'));
    await runTest('listStagnantDeals(7)', () => testListStagnantDeals(7));
    await runTest('listOverdueDeals', testListOverdueDeals);

    // Get a real deal ID for detail test
    const { data: sampleDeal } = await supabase.from('deals').select('id').eq('board_id', BOARD_ID).limit(1).single();
    if (sampleDeal) {
        await runTest(`getDealDetails("${sampleDeal.id.slice(0, 8)}...")`, () => testGetDealDetails(sampleDeal.id));
    }

    // SUMMARY
    console.log('='.repeat(60));
    console.log('📋 SUMMARY');
    console.log('='.repeat(60));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`${colors.green}✅ Passed: ${passed}/${results.length}${colors.reset}`);
    console.log(`${colors.red}❌ Failed: ${failed}/${results.length}${colors.reset}`);

    if (failed > 0) {
        console.log('\n🔴 Failed tests:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`   - ${r.name}: ${r.message}`);
        });
    }

    console.log('\n' + '='.repeat(60));
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
