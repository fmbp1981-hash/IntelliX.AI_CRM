import React from 'react';
import { Key } from 'lucide-react';
import { SettingsSection } from './SettingsSection';

export const ApiKeysSection: React.FC = () => {
  return (
    <SettingsSection title="Chaves de API" icon={Key}>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
        As chaves de API permitem acessar a API do FlowCRM programaticamente. Mantenha essas chaves seguras e não as compartilhe em repositórios públicos.
      </p>
      <div className="flex gap-3 items-center bg-slate-50 dark:bg-black/30 p-4 rounded-lg border border-slate-200 dark:border-white/10 mb-5">
        <code className="text-sm font-mono text-slate-600 dark:text-slate-300 flex-1">sk_live_51Mx...92kd</code>
        <button className="text-xs text-red-500 font-bold hover:text-red-400 uppercase tracking-wider px-3 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Revogar</button>
      </div>
      <button className="px-5 py-2.5 bg-primary-600 text-white text-sm font-bold rounded-lg hover:bg-primary-500 shadow-lg shadow-primary-600/20 transition-all">
        Gerar Nova Chave
      </button>
    </SettingsSection>
  );
};
