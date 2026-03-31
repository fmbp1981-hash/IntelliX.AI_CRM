import { describe, it, expect, vi } from 'vitest';
import { buildHumanizedPipeline, chunkAIResponse, calculateTypingDelay } from '../lib/ai/humanization-edge';
import { getNichePrompt } from '../lib/ai/agent-prompts';
import { buildAgentTools } from '../lib/ai/agent-tools';

// Mock the problematic Next.js server module
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(),
    createAdminClient: vi.fn()
}));

describe('Phase C & D Implementations E2E / Unit Validation', () => {

    it('should chunk AI responses and calculate typing delays (Humanization Engine)', () => {
        const sampleLongResponse = "Olá! Eu sou o assistente virtual da Clínica Saúde. Entendi que você deseja agendar uma consulta para amanhã.\\n\\nPara confirmar, precisamos dos seus dados básicos. Poderia me informar seu nome completo e telefone?\\n\\nApós recebermos essas informações, verificarei a disponibilidade com nossos especialistas.";

        const chunks = chunkAIResponse(sampleLongResponse);
        expect(chunks.length).toBeGreaterThan(0);

        const pipeline = buildHumanizedPipeline(sampleLongResponse);
        expect(pipeline.length).toBe(chunks.length);

        // Ensure delays are calculated
        pipeline.forEach(p => {
            expect(p.estimatedTypingTimeMs).toBeGreaterThanOrEqual(1000); // at least 1 second
            expect(p.text.length).toBeGreaterThan(0);
        });
    });

    it('should load dynamic niche prompts based on vertical', () => {
        const clinicPrompt = getNichePrompt('clinica');
        const realEstatePrompt = getNichePrompt('imobiliaria');
        const fallbackPrompt = getNichePrompt('unknown');

        expect(clinicPrompt).toContain('Empático e acolhedor'); // from Clinic logic
        expect(realEstatePrompt).toContain('Compra ou aluguel?'); // from Real Estate logic
        expect(fallbackPrompt).toBeDefined();
    });

    it('should correctly expose scheduling tools to the Agent (Google Calendar Master)', () => {
        // Stub context
        const dummyCtx = {
            supabase: {} as any,
            organizationId: 'fake-org',
            conversationId: 'fake-conv',
            agentConfig: { default_board_id: null, default_stage_id: null }
        };

        const tools = buildAgentTools(dummyCtx);

        // Assert the keys exist
        expect(tools).toHaveProperty('check_availability');
        expect(tools).toHaveProperty('schedule_appointment');
        expect(tools).toHaveProperty('cancel_appointment');
    });

});
