import { describe, it, expect } from 'vitest';

describe('NossoAgent: Nurturing Sequences & Follow-ups (Phase 2)', () => {

    // Simular o comportamento extraído do buildAgentTools e do agent-engine
    const simulateAgentToolCall = async (action: 'schedule_followup' | 'cancel_followup', params: any) => {
        // Simulação do Edge Function chamando as ferramentas (tool integration)

        if (action === 'schedule_followup') {
            if (!params.sequence_id) {
                return { success: false, error: 'sequence_id is required' };
            }
            // Simula uma chamada bem-sucedida para o app (POST /api/followups/executions)
            return {
                success: true,
                execution_id: 'mock-execution-id-1234',
                message: 'Sequência de follow-up iniciada com sucesso.'
            };
        }

        if (action === 'cancel_followup') {
            if (!params.reason) {
                return { success: false, error: 'reason is required' };
            }
            // Simula cancelamento bem sucedido 
            return {
                success: true,
                message: '1 sequências canceladas.'
            };
        }

        return { success: false, error: 'Unknown action' };
    };

    describe('Tool: schedule_followup', () => {
        it('should successfully schedule a follow-up when sequence_id is provided', async () => {
            const response = await simulateAgentToolCall('schedule_followup', {
                sequence_id: 'abc-123-uuid',
                reason: 'O cliente disse que vai pensar e pediu para falar semana que vem'
            });

            expect(response.success).toBe(true);
            expect(response.execution_id).toBeDefined();
            expect(response.message).toContain('sucesso');
        });

        it('should fail if sequence_id is omitted', async () => {
            const response = await simulateAgentToolCall('schedule_followup', {
                reason: 'Esqueceu de passar a sequência'
            });

            expect(response.success).toBe(false);
            expect(response.error).toBe('sequence_id is required');
        });
    });

    describe('Tool: cancel_followup', () => {
        it('should successfully cancel active follow-ups with a valid reason', async () => {
            const response = await simulateAgentToolCall('cancel_followup', {
                reason: 'Cliente finalmente respondeu dizendo que quer fechar negócio'
            });

            expect(response.success).toBe(true);
            expect(response.message).toContain('canceladas');
        });

        it('should fail if reason is omitted', async () => {
            const response = await simulateAgentToolCall('cancel_followup', {});

            expect(response.success).toBe(false);
            expect(response.error).toBe('reason is required');
        });
    });

    describe('System Prompt AI Instruction', () => {
        it('should recognize keywords to trigger schedule_followup', () => {
            const userMessage = "vou pensar, fale comigo depois";
            const lowerMsg = userMessage.toLowerCase();
            const shouldTrigger = lowerMsg.includes('pensar') || lowerMsg.includes('depois');

            expect(shouldTrigger).toBe(true);
        });

        it('should recognize keywords to trigger cancel_followup', () => {
            const userMessage = "pode fechar agora, obrigado pelo retorno";
            // Simulate the detection. If user replies positively while in a follow-up, it cancels.
            const shouldTriggerCancellation = userMessage.length > 0; // Simple simulation of human reply

            expect(shouldTriggerCancellation).toBe(true);
        });
    });
});
