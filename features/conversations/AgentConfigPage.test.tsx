import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentConfigPage } from './AgentConfigPage';
import * as useAgentConfigModule from '@/hooks/useAgentConfig';

// Mock the hooks
vi.mock('@/hooks/useAgentConfig', () => ({
    useAgentConfig: vi.fn(),
    useUpdateAgentConfig: vi.fn(),
}));

// Mock the AgentMetricsTab since it's an internal complex component not relevant for this config form test
vi.mock('./components/AgentMetricsTab', () => ({
    AgentMetricsTab: () => <div data-testid="agent-metrics-tab">Metrics</div>
}));

describe('AgentConfigPage', () => {
    const mockUpdateMutateAsync = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock for useAgentConfig
        vi.mocked(useAgentConfigModule.useAgentConfig).mockReturnValue({
            data: {
                is_active: false,
                whatsapp_provider: 'evolution_api',
                agent_name: 'NossoAgent',
                ai_model: 'claude-sonnet-4-20250514',
            },
            isLoading: false,
            error: null,
            isError: false,
        } as any);

        // Default mock for useUpdateAgentConfig
        vi.mocked(useAgentConfigModule.useUpdateAgentConfig).mockReturnValue({
            mutateAsync: mockUpdateMutateAsync,
        } as any);
    });

    it('renders loading state when config is not available', () => {
        vi.mocked(useAgentConfigModule.useAgentConfig).mockReturnValue({
            data: null,
            isLoading: true,
        } as any);

        const { container } = render(<AgentConfigPage />);
        expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('renders the configuration tabs and initial data', () => {
        render(<AgentConfigPage />);

        // Verify title
        expect(screen.getByText('NossoAgent')).toBeInTheDocument();

        // Verify tabs exist
        expect(screen.getByText('Conexão')).toBeInTheDocument();
        expect(screen.getByText('Comportamento')).toBeInTheDocument();
        expect(screen.getByText('Horários')).toBeInTheDocument();

        // Verify initial input value from mocked data
        expect(screen.getByDisplayValue('NossoAgent')).toBeInTheDocument();
    });

    it('allows editing fields, switching tabs, and saving changes', async () => {
        render(<AgentConfigPage />);

        // 1. Change Agent Name in 'Conexão' tab
        const nameInput = screen.getByPlaceholderText('NossoAgent');
        fireEvent.change(nameInput, { target: { value: 'SuperAgent' } });

        // Save bar should appear
        expect(screen.getByText('Alterações não salvas')).toBeInTheDocument();

        // 2. Switch to 'Comportamento' tab
        const behaviorTab = screen.getByText('Comportamento');
        fireEvent.click(behaviorTab);

        // Change tokens
        const tokensInput = screen.getByDisplayValue('500'); // default max tokens is fallback in component
        fireEvent.change(tokensInput, { target: { value: '800' } });

        // 3. Save changes
        const saveButton = screen.getByText('Salvar alterações');
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
                agent_name: 'SuperAgent',
                max_tokens_per_response: 800
            });
        });
    });

    it('allows cancelling changes', async () => {
        render(<AgentConfigPage />);

        // Change Agent Name
        const nameInput = screen.getByPlaceholderText('NossoAgent');
        fireEvent.change(nameInput, { target: { value: 'SuperAgent' } });

        const cancelButton = screen.getByText('Cancelar');
        fireEvent.click(cancelButton);

        // The save bar should disappear
        expect(screen.queryByText('Alterações não salvas')).not.toBeInTheDocument();

        // Input should be reset to mocked data
        expect(screen.getByDisplayValue('NossoAgent')).toBeInTheDocument();
    });
});
