import React from 'react';
import { Activity, Deal } from '@/types';
import { ActivityRow } from './ActivityRow';

interface ActivitiesListProps {
    activities: Activity[];
    deals: Deal[];
    onToggleComplete: (id: string) => void;
    onEdit: (activity: Activity) => void;
    onDelete: (id: string) => void;
    selectedActivities?: Set<string>;
    onSelectActivity?: (id: string, selected: boolean) => void;
}

export const ActivitiesList: React.FC<ActivitiesListProps> = ({
    activities,
    deals,
    onToggleComplete,
    onEdit,
    onDelete,
    selectedActivities = new Set(),
    onSelectActivity
}) => {
    if (activities.length === 0) {
        return (
            <div className="text-center py-12 bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-white/5 border-dashed">
                <p className="text-slate-500 dark:text-slate-400">Nenhuma atividade encontrada</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {activities.map(activity => (
                <ActivityRow
                    key={activity.id}
                    activity={activity}
                    deal={deals.find(d => d.id === activity.dealId)}
                    onToggleComplete={onToggleComplete}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    isSelected={selectedActivities.has(activity.id)}
                    onSelect={onSelectActivity}
                />
            ))}
        </div>
    );
};
