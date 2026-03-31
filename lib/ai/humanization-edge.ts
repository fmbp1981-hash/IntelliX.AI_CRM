// lib/ai/humanization-edge.ts

/**
 * Humanization Edge Utility
 * 
 * Como rodamos em Vercel/NextJS (Serverless/Edge), usar setTimeout() 
 * pode fazer as funções sofrerem timeout ou morrerem no background. 
 * Para um motor de "Typing Delay" realista, precisamos:
 * 
 * 1. Quebrar o texto longo retornado pela IA em múltiplos balões.
 * 2. Calcular o tempo de digitação (ex: 200 caracteres por minuto).
 * 3. Repassar essa fila para um sistema assíncrono (Upstash/QStash ou filas internas).
 */

export interface MessageChunk {
    text: string;
    estimatedTypingTimeMs: number; // Tempo calculado de "digitação" antes de enviar esse pedaço
}

/**
 * Quebra uma resposta gigante em balões menores e naturais (Ex: separando por quebras de linha dupla ou pontos finais estratégicos).
 */
export function chunkAIResponse(response: string): string[] {
    if (!response) return [];

    // Tentar fatiar inicialmente por duplas quebras de linha (parágrafos)
    const paragraphs = response.split('\\n\\n').map(p => p.trim()).filter(Boolean);

    // Se o parágrafo ainda for muito grande (>300 caracteres), podemos forçar quebra por frases
    const chunks: string[] = [];

    for (const p of paragraphs) {
        if (p.length > 300) { // Only split if paragraph is too long
            // Divide grosseiramente em sentenças
            const sentences = p.split(/(?<=\.)\s/);
            let current = '';
            for (const s of sentences) {
                if ((current.length + s.length) > 300) {
                    chunks.push(current.trim());
                    current = s;
                } else {
                    current += ' ' + s;
                }
            }
            if (current.trim()) chunks.push(current.trim());
        } else {
            if (p.trim()) chunks.push(p.trim());
        }
    }

    // Force clean the array of any accidental empty traces
    return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Calcula um tempo "humano" de leitura prévia + digitação por pedaço.
 * 
 * Média global: 4 a 6 caracteres por segundo (CPS) na digitação rápida de celular.
 */
export function calculateTypingDelay(text: string): number {
    const chars = text.length;
    const baseDelay = (chars / 5) * 1000; // 5 CPS -> em milissegundos

    // Random jitter de +- 15% para não parecer perfeitamente mecânico
    const jitter = baseDelay * (Math.random() * 0.3 - 0.15);

    // Cap: Mínimo 1.5s, Máximo 12s para um balão não demorar eternamente
    const totalDelay = Math.max(1500, Math.min(12000, baseDelay + jitter));

    return Math.floor(totalDelay);
}

/**
 * Constrói o Output Pipeline para o QStash ou mensageiro nativo
 */
export function buildHumanizedPipeline(aiText: string): MessageChunk[] {
    const texts = chunkAIResponse(aiText);

    return texts.map((text, index) => {
        // O primeiro balão tem menos delay (resposta quase imediata no WhatsApp)
        // Os próximos balões acumulam o delay da digitação do texto atual + do interior.
        let delayMs = calculateTypingDelay(text);
        if (index === 0) {
            delayMs = Math.max(1000, delayMs / 2); // Responde 2x mais rápido na primeira mensagem
        }

        return {
            text,
            estimatedTypingTimeMs: delayMs
        };
    });
}
