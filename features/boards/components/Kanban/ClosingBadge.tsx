'use client'

export function ClosingBadge({ probability }: { probability?: number }) {
  if (probability == null || probability === 0) return null

  const color =
    probability >= 70 ? 'bg-green-100 text-green-700' :
    probability >= 30 ? 'bg-yellow-50 text-yellow-600' :
    'bg-red-100 text-red-700'

  return (
    <span
      className={`inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium tabular-nums ${color}`}
      title={`Probabilidade de fechamento: ${probability}%`}
    >
      {probability}%
    </span>
  )
}
