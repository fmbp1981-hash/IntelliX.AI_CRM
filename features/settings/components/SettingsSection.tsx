import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SettingsSectionProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ title, icon: Icon, children }) => (
  <div className="glass rounded-xl border border-slate-200 dark:border-white/5 shadow-sm p-6 mb-6">
    <div className="flex items-center gap-4 mb-6 border-b border-slate-100 dark:border-white/5 pb-4">
      <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl text-primary-600 dark:text-primary-400 ring-1 ring-primary-100 dark:ring-primary-500/20">
        <Icon size={24} />
      </div>
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">{title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Gerencie suas configurações de {title.toLowerCase()}</p>
      </div>
    </div>
    {children}
  </div>
);
