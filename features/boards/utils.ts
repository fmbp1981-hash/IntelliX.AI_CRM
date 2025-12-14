import { Deal } from '@/types';

export const isDealRotting = (deal: Deal) => {
    const dateToCheck = deal.lastStageChangeDate || deal.updatedAt;
    const diff = new Date().getTime() - new Date(dateToCheck).getTime();
    const days = diff / (1000 * 3600 * 24);
    return days > 10;
};

export const getActivityStatus = (deal: Deal) => {
    if (!deal.nextActivity) return 'yellow';
    if (deal.nextActivity.isOverdue) return 'red';
    const activityDate = new Date(deal.nextActivity.date);
    const today = new Date();
    if (activityDate.toDateString() === today.toDateString()) return 'green';
    return 'gray';
};
