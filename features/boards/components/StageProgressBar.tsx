import React from 'react';
import { BoardStage } from '@/types';

interface StageProgressBarProps {
    stages: BoardStage[];
    currentStatus: string;
    onStageClick: (stageId: string) => void;
}

export const StageProgressBar: React.FC<StageProgressBarProps> = ({ stages, currentStatus, onStageClick }) => {
    return (
        <div className="flex items-center w-full overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
            {stages.map((stage, index, arr) => {
                const isCurrent = currentStatus === stage.id;
                const isPast = arr.findIndex(s => s.id === currentStatus) > index;
                const isWonStage = stage.linkedLifecycleStage === 'CUSTOMER';
                const isLostStage = stage.linkedLifecycleStage === 'OTHER';

                // Determine colors based on stage type
                let activeColor = 'bg-green-500 text-white';
                let inactiveColor = 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600';
                
                if (isWonStage) {
                    activeColor = 'bg-green-500 text-white';
                    inactiveColor = 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50';
                } else if (isLostStage) {
                    activeColor = 'bg-red-500 text-white';
                    inactiveColor = 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50';
                }

                return (
                    <button
                        key={stage.id}
                        onClick={() => onStageClick(stage.id)}
                        className={`flex-1 w-0 py-2 px-2 text-xs font-bold uppercase tracking-wider border-r border-white/20 relative transition-colors outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900 whitespace-nowrap overflow-hidden text-ellipsis
                        ${isCurrent || isPast ? activeColor : inactiveColor}`}
                    >
                        {stage.label}
                    </button>
                );
            })}
        </div>
    );
};
