/**
 * Streak Counter Component
 * 
 * Badge de gamificação mostrando dias consecutivos de ações completas.
 * 🔥 + número de dias + tooltip com status.
 */
import React from 'react';
import { Flame } from 'lucide-react';
import { useUserStreak } from '../hooks/useActionItems';

export const StreakCounter: React.FC = () => {
    const { data: streakData, isLoading } = useUserStreak();

    if (isLoading || !streakData) return null;

    const { streak, todayComplete } = streakData;

    // Não mostrar se streak é 0 e hoje não completou
    if (streak === 0 && !todayComplete) return null;

    return (
        <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium transition-colors ${todayComplete
                    ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10'
                }`}
            title={todayComplete
                ? `${streak} dias consecutivos! Todas as ações de hoje foram concluídas.`
                : `${streak} dias de streak. Complete todas as ações de hoje para continuar!`
            }
        >
            <Flame className={`w-4 h-4 ${todayComplete ? 'text-orange-500' : 'text-slate-400'}`} />
            <span>{streak}</span>
            {streak >= 7 && <span className="text-xs">🔥</span>}
            {streak >= 30 && <span className="text-xs">⚡</span>}
        </div>
    );
};

export default StreakCounter;
