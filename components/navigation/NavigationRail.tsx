import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { PRIMARY_NAV, SECONDARY_NAV } from './navConfig';

export interface NavigationRailProps {
  /** Optional: used only if we want to keep "More" as a sheet trigger (mobile-like). */
  onOpenMore?: () => void;
}

export function NavigationRail({ onOpenMore }: NavigationRailProps) {
  const pathname = usePathname();

  const isHrefActive = (href: string) =>
    pathname === href ||
    (href === '/boards' && pathname === '/pipeline') ||
    (href === '/pipeline' && pathname === '/boards');

  return (
    <nav
      aria-label="Navegação principal (tablet)"
      className={cn(
        'flex',
        'flex-col justify-between',
        'w-20 shrink-0',
        'glass border-r border-[var(--color-border-subtle)]'
      )}
    >
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="w-10 h-10 bg-[var(--color-accent)] rounded-[8px] flex items-center justify-center font-bold text-lg text-[#0f172a]">
          N
        </div>
      </div>

      <div className="flex-1 px-3 py-2 overflow-y-auto scrollbar-custom">
        <div className="space-y-2">
          {PRIMARY_NAV.filter((i) => i.id !== 'more').map((item) => {
            const Icon = item.icon;
            const isActive = item.href ? isHrefActive(item.href) : false;

            return (
              <Link
                key={item.id}
                href={item.href!}
                className={cn(
                  'w-full h-12 rounded-xl flex items-center justify-center transition-colors focus-visible-ring',
                  isActive
                    ? 'bg-[var(--color-accent-muted)] text-[var(--color-accent)] border border-[var(--color-accent)]/20'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-secondary)]'
                )}
                aria-current={isActive ? 'page' : undefined}
                title={item.label}
                aria-label={item.label}
              >
                <Icon className={cn('h-5 w-5', isActive ? 'text-[var(--color-accent)]' : '')} aria-hidden="true" />
              </Link>
            );
          })}
        </div>

        <div className="my-3 h-px bg-[var(--color-border-subtle)]" />

        <div className="space-y-2">
          {SECONDARY_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = isHrefActive(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  'w-full h-12 rounded-xl flex items-center justify-center transition-colors focus-visible-ring',
                  isActive
                    ? 'bg-[var(--color-accent-muted)] text-[var(--color-accent)] border border-[var(--color-accent)]/20'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-secondary)]'
                )}
                aria-current={isActive ? 'page' : undefined}
                title={item.label}
                aria-label={item.label}
              >
                <Icon className={cn('h-5 w-5', isActive ? 'text-[var(--color-accent)]' : '')} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </div>

      <div className="px-3 pb-4" />
    </nav>
  );
}

