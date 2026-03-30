'use client'

/**
 * NurturingDashboardPage — Central de Nutrição de Leads
 *
 * Página `/nutricao` para aprovação e gestão de sugestões de nurturing geradas por IA.
 * Sugestões são organizadas por urgência: crítico, alto, médio, baixo.
 * O vendedor aprova com 1 clique → enviado via WhatsApp/email.
 */

import React, { useState } from 'react'
import {
  Sparkles, CheckCircle, XCircle, Clock, Send, Filter,
  AlertTriangle, TrendingUp, Users, RefreshCw, Settings,
  ChevronDown, MessageCircle, Mail, Zap, Heart, ShoppingBag,
  RotateCcw,
} from 'lucide-react'
import {
  useNurturingSuggestions,
  useApproveNurturing,
  useDismissNurturing,
  useSendNurturing,
  useSnoozeNurturing,
  useNurturingSettings,
  useUpdateNurturingSettings,
} from './hooks/useCustomerIntelligence'
import type { NurturingSuggestion, NurturingType, NurturingUrgency } from '@/types/customer-intelligence'

// ── Helpers ───────────────────────────────────────────────────────────────────

const URGENCY_CONFIG: Record<NurturingUrgency, { label: string; color: string; dot: string }> = {
  critical: { label: 'Crítico', color: 'text-red-600 bg-red-50 border-red-200', dot: 'bg-red-500' },
  high:     { label: 'Alto',    color: 'text-orange-600 bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
  medium:   { label: 'Médio',   color: 'text-yellow-700 bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500' },
  low:      { label: 'Baixo',   color: 'text-blue-600 bg-blue-50 border-blue-200', dot: 'bg-blue-400' },
}

const TYPE_CONFIG: Record<NurturingType, { label: string; icon: React.ReactNode; color: string }> = {
  reactivation:       { label: 'Reativação',      icon: <RotateCcw className="w-3.5 h-3.5" />, color: 'text-red-500' },
  seasonal:           { label: 'Sazonal',          icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'text-amber-500' },
  upsell:             { label: 'Upsell',           icon: <ShoppingBag className="w-3.5 h-3.5" />, color: 'text-green-600' },
  cross_sell:         { label: 'Cross-sell',       icon: <Sparkles className="w-3.5 h-3.5" />, color: 'text-purple-500' },
  follow_up:          { label: 'Follow-up',        icon: <Clock className="w-3.5 h-3.5" />, color: 'text-blue-500' },
  sentiment_recovery: { label: 'Recuperar Humor',  icon: <Heart className="w-3.5 h-3.5" />, color: 'text-pink-500' },
}

function UrgencyBadge({ urgency }: { urgency: NurturingUrgency }) {
  const cfg = URGENCY_CONFIG[urgency]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function TypeBadge({ type }: { type: NurturingType }) {
  const cfg = TYPE_CONFIG[type]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

// ── Suggestion Card ───────────────────────────────────────────────────────────

interface SuggestionCardProps {
  suggestion: NurturingSuggestion
  onApprove: () => void
  onDismiss: () => void
  onSend: (channel: 'whatsapp' | 'email', message?: string) => void
  onSnooze: () => void
  sending: boolean
}

function SuggestionCard({ suggestion, onApprove, onDismiss, onSend, onSnooze, sending }: SuggestionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editedMessage, setEditedMessage] = useState(suggestion.suggested_message)
  const isApproved = suggestion.status === 'approved'

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-sm p-4 space-y-3 hover:border-[var(--sidebar-accent)] transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <UrgencyBadge urgency={suggestion.urgency} />
            <TypeBadge type={suggestion.type} />
          </div>
          <p className="text-sm font-semibold text-[var(--card-fg,#111)] truncate">{suggestion.title}</p>
          {suggestion.contact_name && (
            <p className="text-xs text-[var(--muted-fg,#666)] mt-0.5">
              <Users className="w-3 h-3 inline mr-1" />
              {suggestion.contact_name}
              {suggestion.deal_title && <span className="ml-2 opacity-60">· {suggestion.deal_title}</span>}
            </p>
          )}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[var(--muted-fg,#888)] hover:text-[var(--card-fg,#111)] p-1"
          aria-label="Expandir"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Reason */}
      <p className="text-xs text-[var(--muted-fg,#666)] leading-relaxed">{suggestion.reason}</p>

      {/* Expanded message editor */}
      {expanded && (
        <div className="pt-2 border-t border-[var(--card-border)]">
          <label className="block text-xs font-medium text-[var(--muted-fg,#666)] mb-1">Mensagem sugerida</label>
          <textarea
            className="w-full text-sm border border-[var(--card-border)] rounded-sm px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[var(--sidebar-accent)] bg-[var(--card-bg)]"
            rows={4}
            value={editedMessage}
            onChange={(e) => setEditedMessage(e.target.value)}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {isApproved ? (
          <>
            <button
              onClick={() => onSend('whatsapp', editedMessage)}
              disabled={sending}
              className="flex items-center gap-1.5 text-xs font-medium bg-green-500 text-white px-3 py-1.5 rounded-sm hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {sending ? 'Enviando...' : 'WhatsApp'}
            </button>
            <button
              onClick={() => onSend('email', editedMessage)}
              disabled={sending}
              className="flex items-center gap-1.5 text-xs font-medium bg-blue-500 text-white px-3 py-1.5 rounded-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              Email
            </button>
          </>
        ) : (
          <button
            onClick={onApprove}
            className="flex items-center gap-1.5 text-xs font-medium bg-[var(--sidebar-accent,#6366f1)] text-white px-3 py-1.5 rounded-sm hover:opacity-90 transition-opacity"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Aprovar
          </button>
        )}

        <button
          onClick={onSnooze}
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-fg,#666)] border border-[var(--card-border)] px-3 py-1.5 rounded-sm hover:bg-[var(--card-hover,#f5f5f5)] transition-colors"
        >
          <Clock className="w-3.5 h-3.5" />
          Adiar
        </button>

        <button
          onClick={onDismiss}
          className="ml-auto text-[var(--muted-fg,#999)] hover:text-red-500 p-1 transition-colors"
          aria-label="Descartar"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Auto Mode Toggle ──────────────────────────────────────────────────────────

function AutoModePanel() {
  const { data: settings } = useNurturingSettings()
  const update = useUpdateNurturingSettings()
  const [confirming, setConfirming] = useState(false)

  if (!settings) return null

  const handleToggle = () => {
    if (!settings.nurturing_auto_mode) {
      setConfirming(true)
    } else {
      update.mutate({ nurturing_auto_mode: false })
    }
  }

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-sm p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500" />
            Modo Automático
          </p>
          <p className="text-xs text-[var(--muted-fg,#666)] mt-0.5">
            IA envia sem aprovação — máx. {settings.nurturing_max_auto_per_day} mensagens/dia por contato
          </p>
        </div>
        <button
          onClick={handleToggle}
          className={`relative w-10 h-5 rounded-full transition-colors ${settings.nurturing_auto_mode ? 'bg-amber-500' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.nurturing_auto_mode ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {confirming && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-sm text-xs">
          <p className="font-medium text-amber-800 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Ativar envio automático?
          </p>
          <p className="text-amber-700 mt-1">O agente enviará mensagens sem aprovação prévia. Confirme para ativar.</p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => { update.mutate({ nurturing_auto_mode: true }); setConfirming(false) }}
              className="text-xs bg-amber-500 text-white px-3 py-1 rounded-sm"
            >
              Confirmar
            </button>
            <button onClick={() => setConfirming(false)} className="text-xs text-amber-700 underline">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type FilterStatus = 'pending' | 'approved' | 'all'

export function NurturingDashboardPage() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending')
  const [filterUrgency, setFilterUrgency] = useState<string>('')

  const { data: suggestions = [], isLoading, refetch } = useNurturingSuggestions({
    status: filterStatus === 'all' ? undefined : filterStatus,
    urgency: filterUrgency || undefined,
    limit: 100,
  })

  const approve = useApproveNurturing()
  const dismiss = useDismissNurturing()
  const send = useSendNurturing()
  const snooze = useSnoozeNurturing()

  const handleSend = (suggestion: NurturingSuggestion, channel: 'whatsapp' | 'email', message?: string) => {
    send.mutate({ id: suggestion.id, channel, message })
  }

  const handleSnooze = (id: string) => {
    const until = new Date()
    until.setDate(until.getDate() + 3)
    snooze.mutate({ id, until: until.toISOString() })
  }

  // Group by urgency for display
  const groups: NurturingUrgency[] = ['critical', 'high', 'medium', 'low']
  const grouped = groups.reduce<Record<NurturingUrgency, NurturingSuggestion[]>>((acc, u) => {
    acc[u] = suggestions.filter((s) => s.urgency === u)
    return acc
  }, { critical: [], high: [], medium: [], low: [] })

  const pendingCount = suggestions.length

  return (
    <div className="min-h-screen bg-[var(--topbar-bg,#f9fafb)]">
      {/* Header */}
      <div className="bg-white border-b border-[var(--card-border)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--sidebar-accent,#6366f1)]" />
              Nutrição de Leads
            </h1>
            <p className="text-sm text-[var(--muted-fg,#666)] mt-0.5">
              Sugestões geradas pela IA — aprove e envie com 1 clique
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <span className="text-xs font-medium bg-[var(--sidebar-accent,#6366f1)] text-white px-2.5 py-1 rounded-full">
                {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={() => refetch()}
              className="p-2 text-[var(--muted-fg,#666)] hover:text-[var(--card-fg,#111)] rounded-sm hover:bg-[var(--card-hover,#f5f5f5)] transition-colors"
              aria-label="Atualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className="flex items-center gap-1 bg-[var(--card-bg,#f4f4f5)] rounded-sm p-0.5">
            {(['pending', 'approved', 'all'] as FilterStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`text-xs px-3 py-1.5 rounded-sm font-medium transition-colors ${
                  filterStatus === s
                    ? 'bg-white text-[var(--card-fg,#111)] shadow-sm'
                    : 'text-[var(--muted-fg,#666)]'
                }`}
              >
                {s === 'pending' ? 'Pendentes' : s === 'approved' ? 'Aprovadas' : 'Todas'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-[var(--muted-fg,#666)]" />
            <select
              value={filterUrgency}
              onChange={(e) => setFilterUrgency(e.target.value)}
              className="text-xs border border-[var(--card-border)] rounded-sm px-2 py-1.5 bg-white text-[var(--card-fg,#111)] focus:outline-none"
            >
              <option value="">Qualquer urgência</option>
              <option value="critical">Crítico</option>
              <option value="high">Alto</option>
              <option value="medium">Médio</option>
              <option value="low">Baixo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Suggestions */}
        <div className="lg:col-span-2 space-y-6">
          {isLoading && (
            <div className="flex items-center justify-center py-16 text-[var(--muted-fg,#888)]">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Carregando sugestões...
            </div>
          )}

          {!isLoading && suggestions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Sparkles className="w-10 h-10 text-[var(--muted-fg,#ccc)] mb-3" />
              <p className="text-sm font-medium text-[var(--muted-fg,#888)]">
                Nenhuma sugestão {filterStatus === 'pending' ? 'pendente' : ''}
              </p>
              <p className="text-xs text-[var(--muted-fg,#aaa)] mt-1">
                O agente gera sugestões automaticamente 2× ao dia
              </p>
            </div>
          )}

          {!isLoading && groups.map((urgency) => {
            const items = grouped[urgency]
            if (!items.length) return null
            const cfg = URGENCY_CONFIG[urgency]
            return (
              <section key={urgency}>
                <h2 className={`text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5 ${cfg.color.split(' ')[0]}`}>
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  {cfg.label} · {items.length}
                </h2>
                <div className="space-y-3">
                  {items.map((s) => (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      onApprove={() => approve.mutate(s.id)}
                      onDismiss={() => dismiss.mutate(s.id)}
                      onSend={(channel, msg) => handleSend(s, channel, msg)}
                      onSnooze={() => handleSnooze(s.id)}
                      sending={send.isPending && send.variables?.id === s.id}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <AutoModePanel />

          {/* Stats */}
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-sm p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-fg,#888)]">Resumo</p>
            {groups.map((u) => {
              const count = grouped[u].length
              if (!count) return null
              const cfg = URGENCY_CONFIG[u]
              return (
                <div key={u} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                  <span className="font-semibold">{count}</span>
                </div>
              )
            })}
          </div>

          {/* Info */}
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-sm p-4 text-xs text-[var(--muted-fg,#666)] space-y-2">
            <p className="font-medium text-[var(--card-fg,#111)]">Como funciona</p>
            <p>A IA analisa o perfil comportamental, sentimento nas conversas e padrões de compra para gerar sugestões personalizadas.</p>
            <p>Sugestões são geradas <strong>2× ao dia</strong> (9h e 14h).</p>
          </div>
        </div>
      </div>
    </div>
  )
}
