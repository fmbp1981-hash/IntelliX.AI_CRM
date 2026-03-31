import React, { useState } from 'react';
import Image from 'next/image';
import { DealView } from '@/types';
import { Building2, Hourglass, Trophy, XCircle } from 'lucide-react';
import { ActivityStatusIcon } from './ActivityStatusIcon';
import { priorityAriaLabelPtBr } from '@/lib/utils/priority';
import { SentimentBadge } from './SentimentBadge';
import { ClosingBadge } from './ClosingBadge';

interface DealCardProps {
  deal: DealView;
  isRotting: boolean;
  activityStatus: string;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string, title: string) => void;
  /** Callback de seleção do deal (mantido estável via useCallback no pai para permitir memoização) */
  onSelect: (dealId: string) => void;
  /**
   * Performance: boolean derivado por-card evita prop global mutável.
   * Isso reduz re-render em listas grandes quando o usuário abre/fecha o menu.
   */
  isMenuOpen: boolean;
  setOpenMenuId: (id: string | null) => void;
  onQuickAddActivity: (
    dealId: string,
    type: 'CALL' | 'MEETING' | 'EMAIL',
    dealTitle: string
  ) => void;
  setLastMouseDownDealId: (id: string | null) => void;
  /** Callback to open move-to-stage modal for keyboard accessibility */
  onMoveToStage?: (dealId: string) => void;
}

// Check if deal is closed (won or lost)
const isDealClosed = (deal: DealView) => deal.isWon || deal.isLost;

// Get priority label for accessibility (PT-BR)
const getPriorityLabel = (priority: string | undefined) => priorityAriaLabelPtBr(priority);

// Get initials from name
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const DealCardComponent: React.FC<DealCardProps> = ({
  deal,
  isRotting,
  activityStatus,
  isDragging,
  onDragStart,
  onSelect,
  isMenuOpen,
  setOpenMenuId,
  onQuickAddActivity,
  setLastMouseDownDealId,
  onMoveToStage,
}) => {
  const [localDragging, setLocalDragging] = useState(false);
  const isClosed = isDealClosed(deal);

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(isMenuOpen ? null : deal.id);
  };

  const handleQuickAdd = (type: 'CALL' | 'MEETING' | 'EMAIL') => {
    onQuickAddActivity(deal.id, type, deal.title);
  };

  const handleDragStart = (e: React.DragEvent) => {
    setLocalDragging(true);
    e.dataTransfer.setData('dealId', deal.id);
    // Fallback mapping when optimistic temp id gets replaced mid-drag by a refetch.
    // Do not log title; it can contain PII.
    e.dataTransfer.setData('dealTitle', deal.title || '');
    e.dataTransfer.effectAllowed = 'move';
    onDragStart(e, deal.id, deal.title || '');
  };

  const handleDragEnd = () => {
    setLocalDragging(false);
  };

  const getCardClasses = () => {
    const baseClasses =
      'p-3 rounded-[6px] border-l-4 border-y border-r cursor-grab active:cursor-grabbing group transition-all duration-150 relative select-none shadow-[0_1px_3px_rgba(0,0,0,0.06)]';

    if (deal.isWon) {
      return `${baseClasses} bg-[var(--color-success-bg)] border-[var(--color-success)]/30 ${localDragging || isDragging ? 'opacity-50 rotate-2 scale-95' : 'hover:shadow-[0_4px_8px_rgba(0,0,0,0.08)]'}`;
    }

    if (deal.isLost) {
      return `${baseClasses} bg-[var(--color-error-bg)] border-[var(--color-error)]/30 ${localDragging || isDragging ? 'opacity-50 rotate-2 scale-95' : 'opacity-70 hover:opacity-90'}`;
    }

    return `${baseClasses} bg-[var(--color-surface)] border-[var(--color-border)] ${localDragging || isDragging ? 'opacity-50 rotate-2 scale-95' : 'hover:shadow-[0_4px_8px_rgba(0,0,0,0.08)] hover:border-[var(--color-border-subtle)]'} ${isRotting ? 'opacity-80 saturate-50 border-dashed' : ''}`;
  };

  // Get border-left color class based on status
  const getBorderLeftClass = () => {
    if (deal.isWon) return '!border-l-[var(--color-success)]';
    if (deal.isLost) return '!border-l-[var(--color-error)]';
    // Priority-based colors for open deals
    if (deal.priority === 'high') return '!border-l-[var(--color-error)]';
    if (deal.priority === 'medium') return '!border-l-[var(--color-warning)]';
    return '!border-l-[var(--color-info)]';
  };

  // Build accessible label including visible text (tags)
  const getAriaLabel = () => {
    const parts: string[] = [];

    // Status badges (visible text)
    if (deal.isWon) parts.push('ganho');
    if (deal.isLost) parts.push('perdido');

    // Tags (visible text) - include all shown tags
    const shownTags = deal.tags.slice(0, isClosed ? 1 : 2);
    if (shownTags.length > 0) {
      parts.push(...shownTags);
    }

    // Main content
    parts.push(deal.title);
    if (deal.companyName) parts.push(deal.companyName);
    parts.push(`$${deal.value.toLocaleString()}`);

    // Additional context
    const priority = getPriorityLabel(deal.priority);
    if (priority) parts.push(priority);
    if (isRotting && !isClosed) parts.push('estagnado');

    return parts.join(', ');
  };

  return (
    <div
      data-deal-id={deal.id}
      draggable={!deal.id.startsWith('temp-')}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseDown={() => setLastMouseDownDealId(deal.id)}
      onClick={e => {
        if ((e.target as HTMLElement).closest('button')) return;
        onSelect(deal.id);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!(e.target as HTMLElement).closest('button')) {
            onSelect(deal.id);
          }
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={getAriaLabel()}
      className={`${getCardClasses()} ${getBorderLeftClass()}`}
    >
      {/* Won Badge */}
      {deal.isWon && (
        <div
          className="absolute -top-2 -right-2 bg-[var(--color-success-bg)] text-[var(--color-success)] p-1 rounded-full shadow-sm z-10 flex items-center gap-0.5"
          aria-label="Negócio ganho"
        >
          <Trophy size={12} aria-hidden="true" />
        </div>
      )}

      {/* Lost Badge */}
      {deal.isLost && (
        <div
          className="absolute -top-2 -right-2 bg-[var(--color-error-bg)] text-[var(--color-error)] p-1 rounded-full shadow-sm z-10 flex items-center gap-0.5"
          aria-label={deal.lossReason ? `Perdido: ${deal.lossReason}` : 'Negócio perdido'}
        >
          <XCircle size={12} aria-hidden="true" />
        </div>
      )}

      {/* Rotting indicator - only for open deals */}
      {isRotting && !isClosed && (
        <div
          className="absolute -top-2 -right-2 bg-[var(--color-warning-bg)] text-[var(--color-warning)] p-1 rounded-full shadow-sm z-10"
          aria-label="Negócio estagnado, mais de 10 dias sem atualização"
        >
          <Hourglass size={12} aria-hidden="true" />
        </div>
      )}

      <div className="flex gap-1 mb-2 flex-wrap">
        {/* Won/Lost status badge */}
        {deal.isWon && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]/30">
            ✓ GANHO
          </span>
        )}
        {deal.isLost && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-error-bg)] text-[var(--color-error)] border border-[var(--color-error)]/30">
            ✗ PERDIDO
          </span>
        )}
        {/* Regular tags */}
        {deal.tags.slice(0, isClosed ? 1 : 2).map((tag, index) => (
          <span
            key={`${deal.id}-tag-${index}`}
            className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"
          >
            {tag}
          </span>
        ))}
      </div>

      <h4
        className={`text-sm font-bold font-display leading-snug mb-0.5 ${isRotting ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-primary)]'}`}
      >
        {deal.title}
      </h4>
      {(deal.sentiment || deal.closingProbability) && (
        <div className="flex items-center gap-1 mb-1">
          <SentimentBadge sentiment={deal.sentiment} />
          <ClosingBadge probability={deal.closingProbability} />
        </div>
      )}
      <p className="text-xs text-[var(--color-text-secondary)] mb-3 flex items-center gap-1">
        <Building2 size={10} aria-hidden="true" /> {deal.companyName}
      </p>

      <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          {deal.owner && deal.owner.name !== 'Sem Dono' && (
            deal.owner.avatar ? (
              <Image
                src={deal.owner.avatar}
                alt={`Responsável: ${deal.owner.name}`}
                width={20}
                height={20}
                className="w-5 h-5 rounded-full ring-1 ring-[var(--color-surface)]"
                title={`Responsável: ${deal.owner.name}`}
                unoptimized
              />
            ) : (
              <div
                className="w-5 h-5 rounded-full bg-[var(--color-primary-bg)] text-[var(--color-primary)] flex items-center justify-center text-[9px] font-bold ring-1 ring-[var(--color-surface)]"
                title={`Responsável: ${deal.owner.name}`}
              >
                {getInitials(deal.owner.name)}
              </div>
            )
          )}
          <span className="text-sm font-bold text-[var(--color-text-primary)] font-mono">
            ${deal.value.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center">
          <ActivityStatusIcon
            status={activityStatus}
            type={deal.nextActivity?.type}
            dealId={deal.id}
            dealTitle={deal.title}
            isOpen={isMenuOpen}
            onToggle={handleToggleMenu}
            onQuickAdd={handleQuickAdd}
            onRequestClose={() => setOpenMenuId(null)}
            onMoveToStage={onMoveToStage ? () => onMoveToStage(deal.id) : undefined}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Performance: `DealCard` fica em lista grande (Kanban).
 * Usamos `React.memo` para evitar re-render de TODOS os cards quando apenas o menu de 1 deal muda.
 * Isso depende de props estáveis do pai (ex.: `onSelect` via useCallback e `isMenuOpen` por-card).
 */
export const DealCard = React.memo(DealCardComponent);
