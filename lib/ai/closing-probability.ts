// lib/ai/closing-probability.ts — Closing probability calculator (no AI call, pure math)
import type { ClosingFactors } from '@/types/customer-intelligence'

interface ClosingInput {
  sentimentScore: number           // -100 to 100
  messagesFromClient: number
  totalMessages: number
  qualificationFieldsFilled: number
  qualificationFieldsTotal: number
  daysInCurrentStage: number
  rfmScore: number                 // 3-15
}

const DEFAULT_WEIGHTS = {
  sentiment: 0.25,
  engagement: 0.20,
  qualification: 0.25,
  stage_velocity: 0.15,
  rfm: 0.15,
}

export function calculateClosingProbability(
  input: ClosingInput,
  weights = DEFAULT_WEIGHTS
): { probability: number; factors: ClosingFactors } {
  // Normalize sentiment from [-100, 100] to [0, 100]
  const sentimentFactor = Math.round((input.sentimentScore + 100) / 2)

  // Engagement: ratio of client responses
  const engagementFactor = input.totalMessages > 0
    ? Math.round((input.messagesFromClient / input.totalMessages) * 100)
    : 0

  // Qualification: fields filled ratio
  const qualificationFactor = input.qualificationFieldsTotal > 0
    ? Math.round((input.qualificationFieldsFilled / input.qualificationFieldsTotal) * 100)
    : 50 // default if no required fields

  // Stage velocity: penalize stagnation (100 - 5 per day, min 0)
  const stageVelocityFactor = Math.max(0, 100 - input.daysInCurrentStage * 5)

  // RFM: normalize from [3, 15] to [0, 100]
  const rfmFactor = Math.round(((input.rfmScore - 3) / 12) * 100)

  const factors: ClosingFactors = {
    sentiment: sentimentFactor,
    engagement: engagementFactor,
    qualification: qualificationFactor,
    stage_velocity: stageVelocityFactor,
    rfm: rfmFactor,
  }

  const probability = Math.round(
    factors.sentiment * weights.sentiment +
    factors.engagement * weights.engagement +
    factors.qualification * weights.qualification +
    factors.stage_velocity * weights.stage_velocity +
    factors.rfm * weights.rfm
  )

  return {
    probability: Math.max(0, Math.min(100, probability)),
    factors,
  }
}

export function closingProbabilityColor(probability: number): string {
  if (probability >= 70) return 'text-green-500'
  if (probability >= 30) return 'text-yellow-500'
  return 'text-red-500'
}

export function closingProbabilityLabel(probability: number): string {
  if (probability >= 70) return 'Alta'
  if (probability >= 30) return 'Media'
  return 'Baixa'
}
