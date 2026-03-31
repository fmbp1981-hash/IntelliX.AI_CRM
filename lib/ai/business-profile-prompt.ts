/**
 * @fileoverview Business Profile Prompt Builder
 *
 * Generates system prompt sections from the structured business profile
 * stored in agent_configs.business_profile.
 */

export interface TeamMember {
    name: string;
    role: string;
    specialties: string[];
}

export interface ServiceItem {
    name: string;
    description: string;
    price: string;
    duration: string;
}

export interface BusinessPolicies {
    cancellation: string;
    refund: string;
    warranty: string;
}

export interface FAQ {
    question: string;
    answer: string;
}

export interface BusinessProfile {
    company_name: string;
    niche: string;
    description: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    team: TeamMember[];
    services: ServiceItem[];
    payment_methods: string[];
    differentials: string[];
    policies: BusinessPolicies;
    faq: FAQ[];
    custom_instructions: string;
}

export function buildBusinessProfilePrompt(profile: Partial<BusinessProfile>): string {
    if (!profile || Object.keys(profile).length === 0) return '';

    const sections: string[] = [];
    sections.push('\n## PERFIL DA EMPRESA (Memória do Agente)');

    if (profile.company_name) {
        sections.push(`**Empresa:** ${profile.company_name}`);
    }
    if (profile.description) {
        sections.push(`**Sobre:** ${profile.description}`);
    }
    if (profile.address) {
        sections.push(`**Endereço:** ${profile.address}`);
    }
    if (profile.phone) {
        sections.push(`**Telefone Comercial:** ${profile.phone}`);
    }
    if (profile.email) {
        sections.push(`**Email:** ${profile.email}`);
    }
    if (profile.website) {
        sections.push(`**Website:** ${profile.website}`);
    }

    if (profile.team?.length) {
        sections.push('\n### Equipe');
        profile.team.forEach(m => {
            const specialties = m.specialties?.length ? ` (${m.specialties.join(', ')})` : '';
            sections.push(`- **${m.name}** — ${m.role}${specialties}`);
        });
    }

    if (profile.services?.length) {
        sections.push('\n### Serviços / Produtos');
        profile.services.forEach(s => {
            const meta = [s.price, s.duration].filter(Boolean).join(' | ');
            sections.push(`- **${s.name}**: ${s.description}${meta ? ` [${meta}]` : ''}`);
        });
    }

    if (profile.payment_methods?.length) {
        sections.push(`\n**Formas de Pagamento:** ${profile.payment_methods.join(', ')}`);
    }

    if (profile.differentials?.length) {
        sections.push('\n### Diferenciais');
        profile.differentials.forEach(d => sections.push(`- ${d}`));
    }

    if (profile.policies) {
        const p = profile.policies;
        const policyLines: string[] = [];
        if (p.cancellation) policyLines.push(`- **Cancelamento:** ${p.cancellation}`);
        if (p.refund) policyLines.push(`- **Reembolso:** ${p.refund}`);
        if (p.warranty) policyLines.push(`- **Garantia:** ${p.warranty}`);
        if (policyLines.length) {
            sections.push('\n### Políticas');
            sections.push(...policyLines);
        }
    }

    if (profile.faq?.length) {
        sections.push('\n### FAQ Interno');
        profile.faq.forEach(f => {
            sections.push(`- **P:** ${f.question}`);
            sections.push(`  **R:** ${f.answer}`);
        });
    }

    if (profile.custom_instructions) {
        sections.push(`\n### Instruções Adicionais\n${profile.custom_instructions}`);
    }

    return sections.join('\n');
}
