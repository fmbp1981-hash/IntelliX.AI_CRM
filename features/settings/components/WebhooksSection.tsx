import React from 'react';
import { Webhook } from 'lucide-react';
import { SettingsSection } from './SettingsSection';

export const WebhooksSection: React.FC = () => {
  return (
    <SettingsSection title="Webhooks" icon={Webhook}>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
        Configure endpoints para receber eventos em tempo real como <code>lead.created</code>, <code>deal.won</code>, ou <code>activity.completed</code>.
      </p>
      <div className="space-y-3 mb-5">
        <div className="flex items-center justify-between p-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg group">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 font-mono">https://api.mysite.com/hooks/crm</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 px-2 py-1 rounded uppercase">Ativo</span>
            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">Editar</button>
          </div>
        </div>
      </div>
      <button className="px-5 py-2.5 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-white text-sm font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-white/10 transition-all">
        Adicionar Endpoint
      </button>
    </SettingsSection>
  );
};
