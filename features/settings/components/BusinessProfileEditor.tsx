/**
 * Business Profile Editor
 *
 * UI para configurar o perfil do negócio que alimenta o system prompt do NossoAgent.
 * Permite editar: empresa, equipe, serviços, pagamento, diferenciais, políticas, FAQ e instruções.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    Building2,
    Users,
    Package,
    CreditCard,
    Star,
    Shield,
    HelpCircle,
    FileText,
    Plus,
    Trash2,
    Save,
    Loader2,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import type { BusinessProfile, TeamMember, ServiceItem, FAQ } from '@/lib/ai/business-profile-prompt';

interface SectionProps {
    title: string;
    icon: React.ReactNode;
    defaultOpen?: boolean;
    children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, icon, defaultOpen = false, children }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border border-slate-200 dark:border-white/10 rounded-xl">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 text-left"
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {isOpen && <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-white/5 pt-3">{children}</div>}
        </div>
    );
};

const Input: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }> = ({
    label, value, onChange, placeholder, multiline
}) => (
    <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>
        {multiline ? (
            <textarea
                value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                rows={3}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
        ) : (
            <input
                value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        )}
    </div>
);

interface BusinessProfileEditorProps {
    initialProfile?: Partial<BusinessProfile>;
    onSave: (profile: Partial<BusinessProfile>) => Promise<void>;
    isSaving?: boolean;
}

export const BusinessProfileEditor: React.FC<BusinessProfileEditorProps> = ({
    initialProfile,
    onSave,
    isSaving = false,
}) => {
    const [profile, setProfile] = useState<Partial<BusinessProfile>>(initialProfile || {});
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        if (initialProfile) {
            setProfile(initialProfile);
            setDirty(false);
        }
    }, [initialProfile]);

    const update = useCallback(<K extends keyof BusinessProfile>(key: K, value: BusinessProfile[K]) => {
        setProfile(prev => ({ ...prev, [key]: value }));
        setDirty(true);
    }, []);

    // Team
    const addTeamMember = () => update('team', [...(profile.team || []), { name: '', role: '', specialties: [] }]);
    const removeTeamMember = (i: number) => update('team', (profile.team || []).filter((_, idx) => idx !== i));
    const updateTeamMember = (i: number, field: keyof TeamMember, value: any) => {
        const team = [...(profile.team || [])];
        team[i] = { ...team[i], [field]: value };
        update('team', team);
    };

    // Services
    const addService = () => update('services', [...(profile.services || []), { name: '', description: '', price: '', duration: '' }]);
    const removeService = (i: number) => update('services', (profile.services || []).filter((_, idx) => idx !== i));
    const updateService = (i: number, field: keyof ServiceItem, value: string) => {
        const services = [...(profile.services || [])];
        services[i] = { ...services[i], [field]: value };
        update('services', services);
    };

    // FAQ
    const addFaq = () => update('faq', [...(profile.faq || []), { question: '', answer: '' }]);
    const removeFaq = (i: number) => update('faq', (profile.faq || []).filter((_, idx) => idx !== i));
    const updateFaq = (i: number, field: keyof FAQ, value: string) => {
        const faq = [...(profile.faq || [])];
        faq[i] = { ...faq[i], [field]: value };
        update('faq', faq);
    };

    // Payment methods & differentials as comma-separated
    const paymentStr = (profile.payment_methods || []).join(', ');
    const diffStr = (profile.differentials || []).join(', ');

    const handleSave = async () => {
        await onSave(profile);
        setDirty(false);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Building2 className="w-6 h-6 text-blue-500" />
                        Perfil do Negócio
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Informações que o NossoAgent usa para responder sobre sua empresa.
                    </p>
                </div>
                {dirty && (
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Perfil
                    </button>
                )}
            </div>

            {/* Company Info */}
            <Section title="Informações da Empresa" icon={<Building2 className="w-4 h-4 text-blue-500" />} defaultOpen>
                <div className="grid grid-cols-2 gap-3">
                    <Input label="Nome da Empresa *" value={profile.company_name || ''} onChange={v => update('company_name', v)} placeholder="Ex: Clínica Sorriso" />
                    <Input label="Nicho" value={profile.niche || ''} onChange={v => update('niche', v)} placeholder="Ex: Odontologia" />
                </div>
                <Input label="Descrição" value={profile.description || ''} onChange={v => update('description', v)} placeholder="Breve descrição do negócio..." multiline />
                <div className="grid grid-cols-2 gap-3">
                    <Input label="Endereço" value={profile.address || ''} onChange={v => update('address', v)} placeholder="Rua, Número, Bairro, Cidade" />
                    <Input label="Telefone" value={profile.phone || ''} onChange={v => update('phone', v)} placeholder="(11) 99999-0000" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Input label="Email" value={profile.email || ''} onChange={v => update('email', v)} placeholder="contato@empresa.com" />
                    <Input label="Website" value={profile.website || ''} onChange={v => update('website', v)} placeholder="https://..." />
                </div>
            </Section>

            {/* Team */}
            <Section title={`Equipe (${profile.team?.length || 0})`} icon={<Users className="w-4 h-4 text-emerald-500" />}>
                {(profile.team || []).map((m, i) => (
                    <div key={i} className="flex items-start gap-2 bg-slate-50 dark:bg-black/20 rounded-lg p-3">
                        <div className="flex-1 grid grid-cols-3 gap-2">
                            <input value={m.name} onChange={e => updateTeamMember(i, 'name', e.target.value)} placeholder="Nome" className="px-2 py-1.5 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded text-xs text-slate-700 dark:text-slate-300" />
                            <input value={m.role} onChange={e => updateTeamMember(i, 'role', e.target.value)} placeholder="Cargo" className="px-2 py-1.5 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded text-xs text-slate-700 dark:text-slate-300" />
                            <input value={(m.specialties || []).join(', ')} onChange={e => updateTeamMember(i, 'specialties', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="Especialidades (vírgula)" className="px-2 py-1.5 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded text-xs text-slate-700 dark:text-slate-300" />
                        </div>
                        <button onClick={() => removeTeamMember(i)} className="text-slate-400 hover:text-red-500 mt-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                ))}
                <button onClick={addTeamMember} className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar Membro</button>
            </Section>

            {/* Services */}
            <Section title={`Serviços / Produtos (${profile.services?.length || 0})`} icon={<Package className="w-4 h-4 text-amber-500" />}>
                {(profile.services || []).map((s, i) => (
                    <div key={i} className="flex items-start gap-2 bg-slate-50 dark:bg-black/20 rounded-lg p-3">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                            <input value={s.name} onChange={e => updateService(i, 'name', e.target.value)} placeholder="Nome do serviço" className="px-2 py-1.5 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded text-xs text-slate-700 dark:text-slate-300" />
                            <input value={s.price} onChange={e => updateService(i, 'price', e.target.value)} placeholder="Preço (Ex: R$ 150)" className="px-2 py-1.5 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded text-xs text-slate-700 dark:text-slate-300" />
                            <input value={s.description} onChange={e => updateService(i, 'description', e.target.value)} placeholder="Descrição" className="col-span-1 px-2 py-1.5 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded text-xs text-slate-700 dark:text-slate-300" />
                            <input value={s.duration} onChange={e => updateService(i, 'duration', e.target.value)} placeholder="Duração (Ex: 30min)" className="px-2 py-1.5 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded text-xs text-slate-700 dark:text-slate-300" />
                        </div>
                        <button onClick={() => removeService(i)} className="text-slate-400 hover:text-red-500 mt-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                ))}
                <button onClick={addService} className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar Serviço</button>
            </Section>

            {/* Payment & Differentials */}
            <Section title="Pagamento & Diferenciais" icon={<CreditCard className="w-4 h-4 text-indigo-500" />}>
                <Input
                    label="Formas de Pagamento (separadas por vírgula)"
                    value={paymentStr}
                    onChange={v => update('payment_methods', v.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder="PIX, Cartão, Boleto, Convênios"
                />
                <Input
                    label="Diferenciais (separados por vírgula)"
                    value={diffStr}
                    onChange={v => update('differentials', v.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder="Atendimento 24h, Estacionamento, Wifi Gratuito"
                />
            </Section>

            {/* Policies */}
            <Section title="Políticas" icon={<Shield className="w-4 h-4 text-rose-500" />}>
                <Input label="Cancelamento" value={profile.policies?.cancellation || ''} onChange={v => update('policies', { ...(profile.policies || { cancellation: '', refund: '', warranty: '' }), cancellation: v })} placeholder="Ex: Cancelamento gratuito até 24h antes" />
                <Input label="Reembolso" value={profile.policies?.refund || ''} onChange={v => update('policies', { ...(profile.policies || { cancellation: '', refund: '', warranty: '' }), refund: v })} placeholder="Ex: Reembolso integral em até 30 dias" />
                <Input label="Garantia" value={profile.policies?.warranty || ''} onChange={v => update('policies', { ...(profile.policies || { cancellation: '', refund: '', warranty: '' }), warranty: v })} placeholder="Ex: Garantia de 12 meses nos serviços" />
            </Section>

            {/* FAQ */}
            <Section title={`FAQ Interno (${profile.faq?.length || 0})`} icon={<HelpCircle className="w-4 h-4 text-cyan-500" />}>
                <p className="text-xs text-slate-400 mb-2">Perguntas frequentes que o agente deve saber responder sem buscar na base.</p>
                {(profile.faq || []).map((f, i) => (
                    <div key={i} className="flex items-start gap-2 bg-slate-50 dark:bg-black/20 rounded-lg p-3">
                        <div className="flex-1 space-y-1">
                            <input value={f.question} onChange={e => updateFaq(i, 'question', e.target.value)} placeholder="Pergunta" className="w-full px-2 py-1.5 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded text-xs text-slate-700 dark:text-slate-300" />
                            <input value={f.answer} onChange={e => updateFaq(i, 'answer', e.target.value)} placeholder="Resposta" className="w-full px-2 py-1.5 bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded text-xs text-slate-700 dark:text-slate-300" />
                        </div>
                        <button onClick={() => removeFaq(i)} className="text-slate-400 hover:text-red-500 mt-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                ))}
                <button onClick={addFaq} className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar FAQ</button>
            </Section>

            {/* Custom Instructions */}
            <Section title="Instruções Adicionais" icon={<FileText className="w-4 h-4 text-slate-500" />}>
                <Input
                    label="Instruções customizadas para o agente"
                    value={profile.custom_instructions || ''}
                    onChange={v => update('custom_instructions', v)}
                    placeholder="Ex: Sempre mencionar a promoção de Junho ao final da conversa..."
                    multiline
                />
            </Section>

            {/* Bottom save */}
            {dirty && (
                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Perfil do Negócio
                    </button>
                </div>
            )}
        </div>
    );
};

export default BusinessProfileEditor;
