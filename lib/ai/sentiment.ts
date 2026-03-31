// lib/ai/sentiment.ts — Sentiment analysis using AI
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import type { SentimentLevel } from '@/types/customer-intelligence'

const sentimentSchema = z.object({
  sentiment: z.enum(['very_positive', 'positive', 'neutral', 'negative', 'very_negative']),
  score: z.number().min(-100).max(100),
  reason: z.string().max(100),
})

export type SentimentResult = z.infer<typeof sentimentSchema>

export async function analyzeSentiment(message: string): Promise<SentimentResult> {
  const { object } = await generateObject({
    model: anthropic('claude-haiku-4-5-20251001'),
    schema: sentimentSchema,
    prompt: `Classifique o sentimento desta mensagem de cliente em pt-BR.
Escala: very_positive (+80 a +100), positive (+30 a +79), neutral (-29 a +29), negative (-79 a -30), very_negative (-100 a -80).
Score: numero de -100 a +100.
Reason: max 100 chars, motivo principal.

Mensagem: "${message}"`,
  })
  return object
}

export function sentimentToEmoji(sentiment: SentimentLevel): string {
  const map: Record<SentimentLevel, string> = {
    very_positive: '😄',
    positive: '🙂',
    neutral: '😐',
    negative: '😟',
    very_negative: '😠',
  }
  return map[sentiment]
}

export function sentimentToColor(sentiment: SentimentLevel): string {
  const map: Record<SentimentLevel, string> = {
    very_positive: 'text-green-500',
    positive: 'text-green-400',
    neutral: 'text-yellow-500',
    negative: 'text-orange-500',
    very_negative: 'text-red-500',
  }
  return map[sentiment]
}
