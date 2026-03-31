'use client'

import { useState } from 'react'
import { useCRM } from '@/context/CRMContext'
import {
  usePipelineTriggers,
  useCreatePipelineTrigger,
  useUpdatePipelineTrigger,
  useDeletePipelineTrigger,
} from '@/features/customer-intelligence/hooks/useCustomerIntelligence'
import type { PipelineTrigger, TriggerAction, TriggerActionType, TriggerEvent } from '@/types/customer-intelligence'
import { Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, Zap } from 'lucide-react'

// ─── Constants ─────────────────────────────────────────────────────────────

const ACTION_TYPE_LABELS: Record<TriggerActionType, string> = {
  notify_team:     'Notificar equipe',
  create_activity: 'Criar atividade',
  add_tag:         'Adicionar tag',
  send_email:      'Enviar e-mail (em breve)',
  send_whatsapp:   'Enviar WhatsApp (em breve)',
}

const EVENT_LABELS: Record<TriggerEvent, string> = {
  on_enter: 'Ao entrar no estágio',
  on_exit:  'Ao sair do estágio',
}

const ACTIVITY_TYPES = ['TASK', 'MEETING', 'CALL', 'EMAIL', 'WHATSAPP']

// ─── Action Config Editor ───────────────────────────────────────────────────

function ActionConfigEditor({
  action,
  onChange,
}: {
  action: TriggerAction
  onChange: (updated: TriggerAction) => void
}) {
  const set = (key: string, value: unknown) =>
    onChange({ ...action, config: { ...action.config, [key]: value } })

  if (action.type === 'notify_team') {
    return (
      <input
        className="w-full text-xs border border-[var(--card-border,#e5e7eb)] rounded-sm px-2 py-1.5 bg-[var(--card-bg,#fff)] placeholder:text-[var(--muted-fg,#999)]"
        placeholder="Mensagem da notificação"
        value={(action.config.message as string) ?? ''}
        onChange={(e) => set('message', e.target.value)}
      />
    )
  }

  if (action.type === 'create_activity') {
    return (
      <div className="space-y-1.5">
        <input
          className="w-full text-xs border border-[var(--card-border,#e5e7eb)] rounded-sm px-2 py-1.5 bg-[var(--card-bg,#fff)] placeholder:text-[var(--muted-fg,#999)]"
          placeholder="Título da atividade"
          value={(action.config.title as string) ?? ''}
          onChange={(e) => set('title', e.target.value)}
        />
        <div className="flex gap-2">
          <select
            className="flex-1 text-xs border border-[var(--card-border,#e5e7eb)] rounded-sm px-2 py-1.5 bg-[var(--card-bg,#fff)]"
            value={(action.config.activity_type as string) ?? 'TASK'}
            onChange={(e) => set('activity_type', e.target.value)}
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            max={365}
            className="w-24 text-xs border border-[var(--card-border,#e5e7eb)] rounded-sm px-2 py-1.5 bg-[var(--card-bg,#fff)]"
            placeholder="Prazo (dias)"
            value={(action.config.due_days as number) ?? 1}
            onChange={(e) => set('due_days', Number(e.target.value))}
          />
        </div>
      </div>
    )
  }

  if (action.type === 'add_tag') {
    return (
      <input
        className="w-full text-xs border border-[var(--card-border,#e5e7eb)] rounded-sm px-2 py-1.5 bg-[var(--card-bg,#fff)] placeholder:text-[var(--muted-fg,#999)]"
        placeholder="Nome da tag"
        value={(action.config.tag as string) ?? ''}
        onChange={(e) => set('tag', e.target.value)}
      />
    )
  }

  return (
    <p className="text-[11px] text-[var(--muted-fg,#999)] italic">
      Disponível em breve
    </p>
  )
}

// ─── Trigger Row ────────────────────────────────────────────────────────────

function TriggerRow({ trigger }: { trigger: PipelineTrigger }) {
  const [expanded, setExpanded] = useState(false)
  const updateTrigger = useUpdatePipelineTrigger()
  const deleteTrigger = useDeletePipelineTrigger()

  const toggle = () =>
    updateTrigger.mutate({ id: trigger.id, active: !trigger.active })

  const remove = () => {
    if (confirm('Remover este trigger?')) deleteTrigger.mutate(trigger.id)
  }

  return (
    <div className="border border-[var(--card-border,#e5e7eb)] rounded-sm bg-[var(--card-bg,#fff)]">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[var(--muted-fg,#888)] hover:text-[var(--color-text-primary,#0f172a)] transition-colors"
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[var(--color-text-primary,#0f172a)] truncate">
            {EVENT_LABELS[trigger.trigger_event]}
            {trigger.stage_label && (
              <span className="text-[var(--muted-fg,#888)] font-normal"> · {trigger.stage_label}</span>
            )}
          </p>
          <p className="text-[10px] text-[var(--muted-fg,#888)]">
            {trigger.actions.length} ação{trigger.actions.length !== 1 ? 'ões' : ''}
          </p>
        </div>

        <button
          onClick={toggle}
          disabled={updateTrigger.isPending}
          className="text-[var(--muted-fg,#888)] hover:text-[var(--color-accent,#f5a623)] transition-colors"
          title={trigger.active ? 'Desativar' : 'Ativar'}
        >
          {trigger.active
            ? <ToggleRight className="w-4 h-4 text-green-500" />
            : <ToggleLeft className="w-4 h-4" />}
        </button>

        <button
          onClick={remove}
          disabled={deleteTrigger.isPending}
          className="text-[var(--muted-fg,#888)] hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-[var(--card-border,#e5e7eb)] px-3 py-2 space-y-1.5 bg-[var(--color-muted,#f8fafc)]">
          {trigger.actions.length === 0 && (
            <p className="text-[11px] text-[var(--muted-fg,#999)] italic">Sem ações configuradas</p>
          )}
          {trigger.actions.map((action, i) => (
            <div key={i} className="text-[11px] flex items-start gap-2">
              <span className="font-medium text-[var(--color-text-secondary,#475569)] whitespace-nowrap">
                {ACTION_TYPE_LABELS[action.type]}:
              </span>
              <span className="text-[var(--muted-fg,#888)] break-all">
                {JSON.stringify(action.config)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Create Form ────────────────────────────────────────────────────────────

function CreateTriggerForm({
  boardId,
  stages,
  onCancel,
}: {
  boardId: string
  stages: Array<{ id: string; label: string }>
  onCancel: () => void
}) {
  const createTrigger = useCreatePipelineTrigger()

  const [stageId, setStageId] = useState(stages[0]?.id ?? '')
  const [event, setEvent] = useState<TriggerEvent>('on_enter')
  const [actions, setActions] = useState<TriggerAction[]>([
    { type: 'notify_team', config: { message: '' } },
  ])

  const addAction = () =>
    setActions((prev) => [...prev, { type: 'notify_team', config: {} }])

  const removeAction = (i: number) =>
    setActions((prev) => prev.filter((_, idx) => idx !== i))

  const setActionType = (i: number, type: TriggerActionType) =>
    setActions((prev) =>
      prev.map((a, idx) => (idx === i ? { type, config: {} } : a))
    )

  const updateAction = (i: number, updated: TriggerAction) =>
    setActions((prev) => prev.map((a, idx) => (idx === i ? updated : a)))

  const handleSubmit = () => {
    if (!stageId) return
    createTrigger.mutate(
      { board_id: boardId, stage_id: stageId, trigger_event: event, actions },
      { onSuccess: onCancel }
    )
  }

  return (
    <div className="border border-[var(--color-accent,#f5a623)] rounded-sm bg-[var(--card-bg,#fff)] p-3 space-y-3">
      <p className="text-xs font-semibold text-[var(--color-text-primary,#0f172a)]">Novo Trigger</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-[var(--muted-fg,#888)] uppercase tracking-wide">Estágio</label>
          <select
            className="w-full text-xs border border-[var(--card-border,#e5e7eb)] rounded-sm px-2 py-1.5 bg-[var(--card-bg,#fff)] mt-0.5"
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-[var(--muted-fg,#888)] uppercase tracking-wide">Evento</label>
          <select
            className="w-full text-xs border border-[var(--card-border,#e5e7eb)] rounded-sm px-2 py-1.5 bg-[var(--card-bg,#fff)] mt-0.5"
            value={event}
            onChange={(e) => setEvent(e.target.value as TriggerEvent)}
          >
            {(Object.keys(EVENT_LABELS) as TriggerEvent[]).map((k) => (
              <option key={k} value={k}>{EVENT_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-[var(--muted-fg,#888)] uppercase tracking-wide">Ações</label>
          <button
            onClick={addAction}
            className="text-[10px] text-[var(--color-accent,#f5a623)] hover:underline flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Adicionar ação
          </button>
        </div>

        {actions.map((action, i) => (
          <div key={i} className="space-y-1.5 border border-[var(--card-border,#e5e7eb)] rounded-sm p-2 bg-[var(--color-muted,#f8fafc)]">
            <div className="flex items-center gap-2">
              <select
                className="flex-1 text-xs border border-[var(--card-border,#e5e7eb)] rounded-sm px-2 py-1 bg-[var(--card-bg,#fff)]"
                value={action.type}
                onChange={(e) => setActionType(i, e.target.value as TriggerActionType)}
              >
                {(Object.keys(ACTION_TYPE_LABELS) as TriggerActionType[]).map((t) => (
                  <option key={t} value={t}>{ACTION_TYPE_LABELS[t]}</option>
                ))}
              </select>
              {actions.length > 1 && (
                <button onClick={() => removeAction(i)} className="text-[var(--muted-fg,#888)] hover:text-red-500">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            <ActionConfigEditor action={action} onChange={(u) => updateAction(i, u)} />
          </div>
        ))}
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 border border-[var(--card-border,#e5e7eb)] rounded-sm text-[var(--color-text-secondary,#475569)] hover:bg-[var(--color-muted,#f8fafc)] transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={createTrigger.isPending || !stageId}
          className="text-xs px-3 py-1.5 bg-[var(--color-accent,#f5a623)] text-white rounded-sm hover:bg-[var(--color-accent-hover,#d97706)] transition-colors disabled:opacity-50"
        >
          {createTrigger.isPending ? 'Criando...' : 'Criar Trigger'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function PipelineTriggersBuilder() {
  const { boards } = useCRM()
  const [selectedBoardId, setSelectedBoardId] = useState(boards[0]?.id ?? '')
  const [showCreate, setShowCreate] = useState(false)

  const selectedBoard = boards.find((b) => b.id === selectedBoardId)
  const stages = selectedBoard?.stages ?? []

  const { data: triggers = [], isLoading } = usePipelineTriggers(selectedBoardId || undefined)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary,#0f172a)] flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--color-accent,#f5a623)]" />
            Automações de Pipeline
          </h2>
          <p className="text-xs text-[var(--muted-fg,#888)] mt-0.5">
            Execute ações automaticamente quando um deal entra ou sai de um estágio.
          </p>
        </div>

        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[var(--color-accent,#f5a623)] text-white rounded-sm hover:bg-[var(--color-accent-hover,#d97706)] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Trigger
          </button>
        )}
      </div>

      {/* Board Selector */}
      {boards.length > 1 && (
        <div>
          <label className="text-[10px] text-[var(--muted-fg,#888)] uppercase tracking-wide">Pipeline</label>
          <select
            className="mt-0.5 w-full max-w-xs text-xs border border-[var(--card-border,#e5e7eb)] rounded-sm px-2 py-1.5 bg-[var(--card-bg,#fff)]"
            value={selectedBoardId}
            onChange={(e) => { setSelectedBoardId(e.target.value); setShowCreate(false) }}
          >
            {boards.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Create Form */}
      {showCreate && stages.length > 0 && (
        <CreateTriggerForm
          boardId={selectedBoardId}
          stages={stages}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Triggers List */}
      {isLoading ? (
        <div className="py-8 text-center text-xs text-[var(--muted-fg,#888)]">Carregando triggers...</div>
      ) : triggers.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-[var(--card-border,#e5e7eb)] rounded-sm">
          <Zap className="w-6 h-6 text-[var(--muted-fg,#ccc)] mx-auto mb-2" />
          <p className="text-xs text-[var(--muted-fg,#888)]">Nenhum trigger configurado para este pipeline.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-2 text-xs text-[var(--color-accent,#f5a623)] hover:underline"
          >
            Criar o primeiro trigger
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {triggers.map((trigger) => (
            <TriggerRow key={trigger.id} trigger={trigger} />
          ))}
        </div>
      )}
    </div>
  )
}
