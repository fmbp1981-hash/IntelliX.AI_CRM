'use client'

import { TrendingUp, ShoppingBag, Calendar, AlertTriangle, RefreshCw } from 'lucide-react'
import { useContactIntelligenceProfile } from '@/features/customer-intelligence/hooks/useCustomerIntelligence'
import type { ChurnRisk } from '@/types/customer-intelligence'

const CHURN_COLORS: Record<ChurnRisk, string> = {
  low:     'bg-green-100 text-green-700',
  medium:  'bg-yellow-100 text-yellow-700',
  high:    'bg-orange-100 text-orange-700',
  churned: 'bg-red-100 text-red-700',
  unknown: 'bg-gray-100 text-gray-500',
}

const CHURN_LABELS: Record<ChurnRisk, string> = {
  low:     'Baixo',
  medium:  'Médio',
  high:    'Alto',
  churned: 'Churned',
  unknown: 'Desconhecido',
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

interface Props {
  contactId: string
}

export function ContactIntelligencePanel({ contactId }: Props) {
  const { data: profile, isLoading } = useContactIntelligenceProfile(contactId)

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-[var(--muted-fg,#888)] py-2">
        <RefreshCw className="w-3 h-3 animate-spin" />
        Carregando perfil...
      </div>
    )
  }

  if (!profile) return null

  const rfmScore = profile.rfm_recency + profile.rfm_frequency + profile.rfm_monetary

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-fg,#888)] flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5" />
        Inteligência do Cliente
      </h3>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[var(--card-bg,#fff)] border border-[var(--card-border,#e5e7eb)] rounded-sm p-2">
          <p className="text-[10px] text-[var(--muted-fg,#888)]">Ticket Médio</p>
          <p className="text-sm font-semibold">
            R$ {profile.avg_ticket.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="bg-[var(--card-bg,#fff)] border border-[var(--card-border,#e5e7eb)] rounded-sm p-2">
          <p className="text-[10px] text-[var(--muted-fg,#888)]">RFM Score</p>
          <p className="text-sm font-semibold">{rfmScore}/15</p>
        </div>
        <div className="bg-[var(--card-bg,#fff)] border border-[var(--card-border,#e5e7eb)] rounded-sm p-2">
          <p className="text-[10px] text-[var(--muted-fg,#888)]">Receita Total</p>
          <p className="text-sm font-semibold">
            R$ {profile.total_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="bg-[var(--card-bg,#fff)] border border-[var(--card-border,#e5e7eb)] rounded-sm p-2">
          <p className="text-[10px] text-[var(--muted-fg,#888)]">Risco Churn</p>
          <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CHURN_COLORS[profile.churn_risk]}`}>
            {CHURN_LABELS[profile.churn_risk]}
          </span>
        </div>
      </div>

      {/* Preferred Products */}
      {profile.preferred_products.length > 0 && (
        <div>
          <p className="text-[10px] text-[var(--muted-fg,#888)] mb-1 flex items-center gap-1">
            <ShoppingBag className="w-3 h-3" /> Produtos Preferidos
          </p>
          <div className="flex flex-wrap gap-1">
            {profile.preferred_products.slice(0, 5).map((p) => (
              <span
                key={p.name}
                className="text-[10px] bg-[var(--card-bg,#f4f4f5)] border border-[var(--card-border,#e5e7eb)] px-1.5 py-0.5 rounded-full"
              >
                {p.name} ({p.count}×)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Peak Months */}
      {profile.peak_months.length > 0 && (
        <div>
          <p className="text-[10px] text-[var(--muted-fg,#888)] mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Meses de Pico
          </p>
          <div className="flex flex-wrap gap-1">
            {profile.peak_months.slice(0, 4).map((m) => (
              <span
                key={m.month}
                className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full"
              >
                {MONTH_NAMES[m.month - 1]} ({m.deals_count} deals)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Inactive warning */}
      {profile.days_since_last_purchase > 30 && (
        <div className="flex items-center gap-1 text-xs text-orange-500">
          <AlertTriangle className="w-3 h-3" />
          {profile.days_since_last_purchase} dias sem compra
        </div>
      )}
    </div>
  )
}
