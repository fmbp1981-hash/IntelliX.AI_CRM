import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSettingsController } from './hooks/useSettingsController';
import { TagsManager } from './components/TagsManager';
import { CustomFieldsManager } from './components/CustomFieldsManager';
import { ApiKeysSection } from './components/ApiKeysSection';
import { WebhooksSection } from './components/WebhooksSection';
import { McpSection } from './components/McpSection';
import { DataStorageSettings } from './components/DataStorageSettings';
import { ProductsCatalogManager } from './components/ProductsCatalogManager';
import { AICenterSettings } from './AICenterSettings';

import { UsersPage } from './UsersPage';
import { useAuth } from '@/context/AuthContext';
import { Settings as SettingsIcon, Users, Database, Sparkles, Plug, Package, Bell, RotateCcw, BarChart3, FileText, MessageSquare, Building2, Mail, Zap } from 'lucide-react';

type SettingsTab = 'general' | 'products' | 'integrations' | 'ai' | 'business-profile' | 'notifications' | 'sequences' | 'templates' | 'followups' | 'reports' | 'campaigns' | 'automations' | 'data' | 'users';

interface GeneralSettingsProps {
  hash?: string;
  isAdmin: boolean;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ hash, isAdmin }) => {
  const controller = useSettingsController();

  // Scroll to hash element (e.g., #ai-config)
  useEffect(() => {
    if (hash) {
      const elementId = hash.slice(1); // Remove #
      setTimeout(() => {
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [hash]);


  return (
    <div className="pb-10">
      {/* General Settings */}
      <div className="mb-12">
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Nicho de Mercado (Vertical)</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Altere o nicho do CRM para habilitar configurações, widgets do painel e fluxos de trabalho específicos (ex: Clínica Médica, Imobiliária).
          </p>
          <a
            href="/onboarding/nicho"
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Selecionar Nicho
          </a>
        </div>

        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Página Inicial</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Escolha qual tela deve abrir quando você iniciar o CRM.
          </p>
          <select
            aria-label="Selecionar página inicial"
            value={controller.defaultRoute}
            onChange={(e) => controller.setDefaultRoute(e.target.value)}
            className="w-full max-w-xs px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-slate-900 dark:text-white transition-all"
          >
            <option value="/dashboard">Dashboard</option>
            <option value="/inbox-list">Inbox (Lista)</option>
            <option value="/inbox-focus">Inbox (Foco)</option>
            <option value="/boards">Boards (Kanban)</option>
            <option value="/contacts">Contatos</option>
            <option value="/activities">Atividades</option>
            <option value="/reports">Relatórios</option>
          </select>
        </div>
      </div>

      {isAdmin && (
        <>
          <TagsManager
            availableTags={controller.availableTags}
            newTagName={controller.newTagName}
            setNewTagName={controller.setNewTagName}
            onAddTag={controller.handleAddTag}
            onRemoveTag={controller.removeTag}
          />

          <CustomFieldsManager
            customFieldDefinitions={controller.customFieldDefinitions}
            newFieldLabel={controller.newFieldLabel}
            setNewFieldLabel={controller.setNewFieldLabel}
            newFieldType={controller.newFieldType}
            setNewFieldType={controller.setNewFieldType}
            newFieldOptions={controller.newFieldOptions}
            setNewFieldOptions={controller.setNewFieldOptions}
            editingId={controller.editingId}
            onStartEditing={controller.startEditingField}
            onCancelEditing={controller.cancelEditingField}
            onSaveField={controller.handleSaveField}
            onRemoveField={controller.removeCustomField}
          />
        </>
      )}

    </div>
  );
};

const ProductsSettings: React.FC = () => {
  return (
    <div className="pb-10">
      <ProductsCatalogManager />
    </div>
  );
};

const IntegrationsSettings: React.FC = () => {
  type IntegrationsSubTab = 'api' | 'webhooks' | 'mcp';
  const [subTab, setSubTab] = useState<IntegrationsSubTab>('api');

  useEffect(() => {
    const syncFromHash = () => {
      const h = typeof window !== 'undefined' ? (window.location.hash || '').replace('#', '') : '';
      if (h === 'webhooks' || h === 'api' || h === 'mcp') setSubTab(h as IntegrationsSubTab);
    };

    syncFromHash();

    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', syncFromHash);
      return () => window.removeEventListener('hashchange', syncFromHash);
    }
  }, []);

  const setSubTabAndHash = (t: IntegrationsSubTab) => {
    setSubTab(t);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.hash = `#${t}`;
      window.history.replaceState({}, '', url.toString());
    }
  };

  return (
    <div className="pb-10">
      <div className="flex items-center gap-2 mb-6">
        {([
          { id: 'webhooks' as const, label: 'Webhooks' },
          { id: 'api' as const, label: 'API' },
          { id: 'mcp' as const, label: 'MCP' },
        ] as const).map((t) => {
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTabAndHash(t.id)}
              className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${active
                ? 'border-primary-500/50 bg-primary-500/10 text-primary-700 dark:text-primary-300'
                : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {subTab === 'api' && <ApiKeysSection />}
      {subTab === 'webhooks' && <WebhooksSection />}
      {subTab === 'mcp' && <McpSection />}
    </div>
  );
};

// ── Business Profile Editor Wrapper ──
const BusinessProfileEditorWrapper: React.FC<{ LazyEditor: React.ComponentType<any> }> = ({ LazyEditor }) => {
  const [profile, setProfile] = React.useState<Record<string, any>>({});
  const [saving, setSaving] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/settings/agent', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setProfile(d.data?.business_profile || {});
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const handleSave = async (bp: Record<string, any>) => {
    setSaving(true);
    try {
      await fetch('/api/settings/agent', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_profile: bp }),
      });
      setProfile(bp);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <div className="py-12 text-center text-slate-400">Carregando...</div>;

  return <LazyEditor initialProfile={profile} onSave={handleSave} isSaving={saving} />;
};

interface SettingsPageProps {
  tab?: SettingsTab;
}

/**
 * Componente React `SettingsPage`.
 *
 * @param {SettingsPageProps} { tab: initialTab } - Parâmetro `{ tab: initialTab }`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
const SettingsPage: React.FC<SettingsPageProps> = ({ tab: initialTab }) => {
  const { profile } = useAuth();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'general');

  // Get hash from URL for scrolling
  const hash = typeof window !== 'undefined' ? window.location.hash : '';

  // Determine tab from pathname if available
  useEffect(() => {
    if (pathname?.includes('/settings/ai')) {
      setActiveTab('ai');
    } else if (pathname?.includes('/settings/products')) {
      setActiveTab('products');
    } else if (pathname?.includes('/settings/integracoes')) {
      setActiveTab('integrations');
    } else if (pathname?.includes('/settings/data')) {
      setActiveTab('data');
    } else if (pathname?.includes('/settings/users')) {
      setActiveTab('users');
    } else {
      setActiveTab('general');
    }
  }, [pathname]);

  const tabs = [
    { id: 'general' as SettingsTab, name: 'Geral', icon: SettingsIcon },
    ...(profile?.role === 'admin' ? [{ id: 'products' as SettingsTab, name: 'Produtos/Serviços', icon: Package }] : []),
    ...(profile?.role === 'admin' ? [{ id: 'integrations' as SettingsTab, name: 'Integrações', icon: Plug }] : []),
    { id: 'ai' as SettingsTab, name: 'NossoAgent', icon: Sparkles },
    { id: 'business-profile' as SettingsTab, name: 'Perfil do Negócio', icon: Building2 },
    { id: 'notifications' as SettingsTab, name: 'Notificações', icon: Bell },
    { id: 'sequences' as SettingsTab, name: 'Sequências', icon: RotateCcw },
    { id: 'templates' as SettingsTab, name: 'Templates', icon: FileText },
    { id: 'followups' as SettingsTab, name: 'Follow-ups', icon: MessageSquare },
    { id: 'campaigns' as SettingsTab, name: 'Campanhas', icon: Mail },
    { id: 'automations' as SettingsTab, name: 'Automações', icon: Zap },
    { id: 'reports' as SettingsTab, name: 'Relatórios', icon: BarChart3 },
    { id: 'data' as SettingsTab, name: 'Dados', icon: Database },
    ...(profile?.role === 'admin' ? [{ id: 'users' as SettingsTab, name: 'Equipe', icon: Users }] : []),
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'products':
        return <ProductsSettings />;
      case 'integrations':
        return <IntegrationsSettings />;
      case 'ai':
        return <AICenterSettings />;
      case 'notifications': {
        const NotificationPreferencesSection = React.lazy(
          () => import('./components/NotificationPreferencesSection')
        );
        return (
          <React.Suspense fallback={<div className="py-12 text-center text-slate-400">Carregando...</div>}>
            <div className="pb-10"><NotificationPreferencesSection /></div>
          </React.Suspense>
        );
      }
      case 'business-profile': {
        const BusinessProfileEditor = React.lazy(
          () => import('./components/BusinessProfileEditor')
        );
        return (
          <React.Suspense fallback={<div className="py-12 text-center text-slate-400">Carregando...</div>}>
            <div className="pb-10">
              <BusinessProfileEditorWrapper LazyEditor={BusinessProfileEditor} />
            </div>
          </React.Suspense>
        );
      }
      case 'sequences': {
        const SequencesManager = React.lazy(
          () => import('./components/SequencesManager')
        );
        return (
          <React.Suspense fallback={<div className="py-12 text-center text-slate-400">Carregando...</div>}>
            <div className="pb-10"><SequencesManager /></div>
          </React.Suspense>
        );
      }
      case 'templates': {
        const DealTemplatesManager = React.lazy(
          () => import('./components/DealTemplatesManager')
        );
        return (
          <React.Suspense fallback={<div className="py-12 text-center text-slate-400">Carregando...</div>}>
            <div className="pb-10"><DealTemplatesManager /></div>
          </React.Suspense>
        );
      }
      case 'followups': {
        const FollowupsManager = React.lazy(
          () => import('./components/FollowupsManager')
        );
        return (
          <React.Suspense fallback={<div className="py-12 text-center text-slate-400">Carregando...</div>}>
            <div className="pb-10"><FollowupsManager /></div>
          </React.Suspense>
        );
      }
      case 'campaigns': {
        const CampaignsManager = React.lazy(
          () => import('@/features/campaigns/CampaignsManager')
        );
        return (
          <React.Suspense fallback={<div className="py-12 text-center text-slate-400">Carregando...</div>}>
            <div className="pb-10"><CampaignsManager /></div>
          </React.Suspense>
        );
      }
      case 'automations': {
        const PipelineTriggersBuilder = React.lazy(
          () => import('./components/PipelineTriggersBuilder').then(m => ({ default: m.PipelineTriggersBuilder }))
        );
        return (
          <React.Suspense fallback={<div className="py-12 text-center text-slate-400">Carregando...</div>}>
            <div className="pb-10"><PipelineTriggersBuilder /></div>
          </React.Suspense>
        );
      }
      case 'reports': {
        const QuickReportsPanel = React.lazy(
          () => import('./components/QuickReportsPanel')
        );
        return (
          <React.Suspense fallback={<div className="py-12 text-center text-slate-400">Carregando...</div>}>
            <div className="pb-10"><QuickReportsPanel /></div>
          </React.Suspense>
        );
      }
      case 'data':
        return <DataStorageSettings />;
      case 'users':
        return <UsersPage />;
      default:
        return <GeneralSettings hash={hash} isAdmin={profile?.role === 'admin'} />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Tabs minimalistas */}
      <div className="flex items-center gap-1 mb-8 border-b border-slate-200 dark:border-white/10">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${isActive
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  );
};

export default SettingsPage;

