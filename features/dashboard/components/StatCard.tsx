import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtext: string;
  subtextPositive?: boolean;
  /** CSS color value for the top border accent. e.g. "var(--color-accent)" or "var(--color-info)" */
  accentColor?: string;
  icon: React.ElementType;
  onClick?: () => void;
  comparisonLabel?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  subtextPositive,
  accentColor = 'var(--color-accent)',
  icon: Icon,
  onClick,
  comparisonLabel = 'vs período anterior',
}) => {
  const hasDelta = subtextPositive !== undefined;
  const TrendIcon = !hasDelta ? Minus : subtextPositive ? TrendingUp : TrendingDown;
  const deltaColor = !hasDelta
    ? 'text-[var(--color-text-muted)]'
    : subtextPositive
    ? 'text-[var(--color-success)]'
    : 'text-[var(--color-error)]';

  return (
    <div
      onClick={onClick}
      style={{ borderTop: `3px solid ${accentColor}` }}
      className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[8px] p-4 transition-all duration-150${onClick ? ' cursor-pointer hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-px' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)] mb-2">
            {title}
          </p>
          <p className="font-display text-[28px] font-extrabold leading-none tracking-[-0.04em] text-[var(--color-text-primary)] tabular-nums">
            {value}
          </p>
        </div>
        <div
          className="p-2.5 rounded-[6px] shrink-0"
          style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 12%, transparent)` }}
        >
          <Icon
            size={18}
            strokeWidth={2}
            style={{ color: accentColor }}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-3">
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${deltaColor}`}>
          <TrendIcon size={11} strokeWidth={2.5} aria-hidden="true" />
          {subtext}
        </span>
        <span className="text-[11px] text-[var(--color-text-subtle)]">{comparisonLabel}</span>
      </div>
    </div>
  );
};
