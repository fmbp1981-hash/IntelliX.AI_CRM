'use client'

import type { SentimentLevel } from '@/types/customer-intelligence'

const config: Record<SentimentLevel, { emoji: string; bg: string; label: string }> = {
  very_positive: { emoji: '😄', bg: 'bg-green-100 text-green-700', label: 'Muito positivo' },
  positive: { emoji: '🙂', bg: 'bg-green-50 text-green-600', label: 'Positivo' },
  neutral: { emoji: '😐', bg: 'bg-yellow-50 text-yellow-600', label: 'Neutro' },
  negative: { emoji: '😟', bg: 'bg-orange-50 text-orange-600', label: 'Negativo' },
  very_negative: { emoji: '😠', bg: 'bg-red-100 text-red-700', label: 'Muito negativo' },
}

export function SentimentBadge({ sentiment }: { sentiment?: SentimentLevel }) {
  if (!sentiment || sentiment === 'neutral') return null
  const c = config[sentiment]
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium ${c.bg}`}
      title={c.label}
    >
      {c.emoji}
    </span>
  )
}
