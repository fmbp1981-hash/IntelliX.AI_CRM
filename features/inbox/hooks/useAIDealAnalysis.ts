/**
 * AI Deal Analysis Hook
 * Fetches real AI analysis for a deal using the AI Proxy
 */
import { useQuery } from '@tanstack/react-query';
import { analyzeLead } from '@/services/geminiService';
import { Deal, DealView } from '@/types';

export interface AIAnalysis {
    action: string;       // Ação curta (max 50 chars)
    reason: string;       // Razão breve (max 80 chars)
    actionType: 'CALL' | 'MEETING' | 'EMAIL' | 'TASK' | 'WHATSAPP';
    urgency: 'low' | 'medium' | 'high';
    probabilityScore: number;
    error?: string;
    // Legacy field for backward compatibility
    suggestion?: string;
}

/**
 * Hook to get AI-powered analysis for a deal
 * Returns actionable NBA with structured data
 */
export function useAIDealAnalysis(
    deal: Deal | DealView | null | undefined,
    stageLabel?: string,
    options?: { enabled?: boolean }
) {
    return useQuery<AIAnalysis>({
        queryKey: ['ai-deal-analysis', deal?.id, stageLabel],
        queryFn: async () => {
            if (!deal) {
                return {
                    action: '',
                    reason: '',
                    actionType: 'TASK' as const,
                    urgency: 'low' as const,
                    probabilityScore: 0
                };
            }

            try {
                const result = await analyzeLead(deal, undefined, stageLabel);

                // Handle new structured format
                if ('action' in result && 'actionType' in result) {
                    return result as AIAnalysis;
                }

                // Handle legacy format (backwards compatibility)
                if ('suggestion' in result) {
                    return {
                        action: (result as any).suggestion?.split('.')[0]?.slice(0, 50) || 'Analisar deal',
                        reason: (result as any).suggestion?.split('.')[1]?.slice(0, 80) || '',
                        actionType: 'TASK' as const,
                        urgency: 'medium' as const,
                        probabilityScore: result.probabilityScore,
                        suggestion: (result as any).suggestion,
                    };
                }

                return result as AIAnalysis;
            } catch (error) {
                console.error('[AI Analysis] Error:', error);
                return {
                    action: 'Analisar deal manualmente',
                    reason: 'Não foi possível obter análise da IA',
                    actionType: 'TASK' as const,
                    urgency: 'low' as const,
                    probabilityScore: deal.probability || 50,
                    error: String(error),
                };
            }
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
        enabled: options?.enabled !== false && !!deal?.id,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

/**
 * Derive health score from AI probability
 * Maps 0-100 probability to a health status
 */
export function deriveHealthFromProbability(probability: number): {
    score: number;
    status: 'critical' | 'warning' | 'good' | 'excellent';
    color: string;
} {
    if (probability >= 80) {
        return { score: probability, status: 'excellent', color: 'text-emerald-400' };
    } else if (probability >= 60) {
        return { score: probability, status: 'good', color: 'text-green-400' };
    } else if (probability >= 40) {
        return { score: probability, status: 'warning', color: 'text-orange-400' };
    } else {
        return { score: probability, status: 'critical', color: 'text-red-400' };
    }
}
