#!/usr/bin/env node
/**
 * AI Tools Test Script
 * Testa todas as 15 tools da IA com perguntas reais de vendedores
 * 
 * Uso: npx ts-node scripts/test-ai-tools.ts
 */

const API_URL = 'http://localhost:3000/api/ai/chat';

// Contexto do board para testes (usar IDs reais do seu banco)
const TEST_CONTEXT = {
    boardId: '3f347a83-b275-448e-9425-a6abde132811', // Pipeline de Vendas
    boardName: 'Pipeline de Vendas',
    stages: [
        { id: '1', name: 'Descoberta' },
        { id: '2', name: 'Proposta' },
    ],
    dealCount: 10,
    pipelineValue: 137000,
};

// Perguntas reais de vendedores - cada uma deve acionar uma tool diferente
const TEST_PROMPTS: Array<{ name: string; prompt: string; expectedTool: string }> = [
    // ANÁLISE
    { name: 'analyzePipeline', prompt: 'analise meu pipeline de vendas', expectedTool: 'analyzePipeline' },
    { name: 'getBoardMetrics', prompt: 'quais são as métricas do meu board?', expectedTool: 'getBoardMetrics' },

    // BUSCA
    { name: 'searchDeals', prompt: 'busque deals com Nike no título', expectedTool: 'searchDeals' },
    { name: 'searchContacts', prompt: 'procure contatos com o nome João', expectedTool: 'searchContacts' },
    { name: 'listDealsByStage', prompt: 'quantos deals tenho no estágio Proposta?', expectedTool: 'listDealsByStage' },
    { name: 'listStagnantDeals', prompt: 'quais deals estão parados há mais de 5 dias?', expectedTool: 'listStagnantDeals' },
    { name: 'listOverdueDeals', prompt: 'quais deals têm atividades atrasadas?', expectedTool: 'listOverdueDeals' },
    { name: 'getDealDetails', prompt: 'me dê detalhes do deal com id 6a2ea595-ba6d-40ef-8375-b6463058b9ac', expectedTool: 'getDealDetails' },

    // AÇÕES (estas precisam de aprovação - só testamos se a tool é chamada)
    { name: 'createTask', prompt: 'crie uma tarefa de ligar para o cliente amanhã', expectedTool: 'createTask' },
    // { name: 'createDeal', prompt: 'crie um deal chamado Teste com valor 5000', expectedTool: 'createDeal' },
    // { name: 'moveDeal', prompt: 'mova o deal Nike para o estágio Proposta', expectedTool: 'moveDeal' },
];

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface TestResult {
    name: string;
    prompt: string;
    expectedTool: string;
    success: boolean;
    toolCalled?: string;
    response?: string;
    error?: string;
    duration: number;
}

async function callAI(prompt: string): Promise<{ text: string; toolsCalled: string[] }> {
    const messages: Message[] = [{ role: 'user', content: prompt }];

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': process.env.AUTH_COOKIE || '', // Auth cookie from browser
        },
        body: JSON.stringify({
            messages: messages.map(m => ({
                id: crypto.randomUUID(),
                role: m.role,
                content: m.content,
                parts: [{ type: 'text', text: m.content }],
            })),
            context: TEST_CONTEXT,
        }),
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    // Read streaming response
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    let fullText = '';
    const toolsCalled: string[] = [];
    const decoder = new TextDecoder();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullText += chunk;

        // Parse SSE events to find tool calls
        const lines = chunk.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.toolName) {
                        toolsCalled.push(data.toolName);
                    }
                } catch {
                    // Not JSON, skip
                }
            }
        }
    }

    return { text: fullText, toolsCalled };
}

async function runTest(test: typeof TEST_PROMPTS[0]): Promise<TestResult> {
    const start = Date.now();

    try {
        console.log(`\n🧪 Testing: ${test.name}`);
        console.log(`   Prompt: "${test.prompt}"`);
        console.log(`   Expected tool: ${test.expectedTool}`);

        const result = await callAI(test.prompt);
        const duration = Date.now() - start;

        const toolCalled = result.toolsCalled[0] || 'none';
        const success = result.toolsCalled.includes(test.expectedTool);

        if (success) {
            console.log(`   ✅ PASSED (${duration}ms) - Tool "${toolCalled}" was called`);
        } else {
            console.log(`   ❌ FAILED (${duration}ms) - Expected "${test.expectedTool}", got "${toolCalled}"`);
            console.log(`   Response preview: ${result.text.slice(0, 200)}...`);
        }

        return {
            name: test.name,
            prompt: test.prompt,
            expectedTool: test.expectedTool,
            success,
            toolCalled,
            response: result.text.slice(0, 500),
            duration,
        };
    } catch (error: any) {
        const duration = Date.now() - start;
        console.log(`   💥 ERROR (${duration}ms): ${error.message}`);

        return {
            name: test.name,
            prompt: test.prompt,
            expectedTool: test.expectedTool,
            success: false,
            error: error.message,
            duration,
        };
    }
}

async function main() {
    console.log('🚀 AI Tools Test Suite');
    console.log('='.repeat(60));
    console.log(`Testing ${TEST_PROMPTS.length} prompts against /api/ai/chat`);
    console.log(`Board ID: ${TEST_CONTEXT.boardId}`);
    console.log('='.repeat(60));

    if (!process.env.AUTH_COOKIE) {
        console.log('\n⚠️  WARNING: No AUTH_COOKIE set. Get it from browser DevTools:');
        console.log('   1. Open DevTools > Application > Cookies');
        console.log('   2. Copy the value of "sb-xxx-auth-token"');
        console.log('   3. Run: AUTH_COOKIE="sb-xxx-auth-token=..." npx ts-node scripts/test-ai-tools.ts\n');
    }

    const results: TestResult[] = [];

    for (const test of TEST_PROMPTS) {
        const result = await runTest(test);
        results.push(result);

        // Wait a bit between tests to not overwhelm the API
        await new Promise(r => setTimeout(r, 1000));
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));

    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const errors = results.filter(r => r.error).length;

    console.log(`✅ Passed: ${passed}/${results.length}`);
    console.log(`❌ Failed: ${failed}/${results.length}`);
    console.log(`💥 Errors: ${errors}/${results.length}`);

    if (failed > 0) {
        console.log('\n🔴 Failed Tests:');
        results.filter(r => !r.success).forEach(r => {
            console.log(`   - ${r.name}: expected "${r.expectedTool}", got "${r.toolCalled || r.error}"`);
        });
    }

    // Write detailed results to file
    const fs = await import('fs');
    const resultsPath = './scripts/test-results.json';
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n📝 Detailed results saved to: ${resultsPath}`);

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
