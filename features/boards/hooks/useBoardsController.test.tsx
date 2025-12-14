import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBoardsController } from './useBoardsController';
import { DealView, Board, BoardStage, DealStatus } from '@/types';

// Mocks
const mockAddToast = vi.fn();
const mockSetSearchParams = vi.fn();

vi.mock('@/context/ToastContext', () => ({
    useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('@/context/AuthContext', () => ({
    useAuth: () => ({
        profile: { id: 'user-1', name: 'Thales', organization_id: 'org-1' },
        organizationId: 'org-1',
    }),
}));

vi.mock('@/context/CRMContext', () => ({
    useCRM: () => ({
        lifecycleStages: [{ id: 'stage-1', name: 'Lead', color: 'bg-blue-500' }],
    }),
}));

vi.mock('react-router-dom', () => ({
    useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
}));

// Mock Query Hooks
const mockBoards: Board[] = [
    {
        id: 'board-1',
        name: 'Sales Board',
        description: '',
        createdAt: new Date().toISOString(),
        isDefault: true,
        stages: [
            { id: 'stage-open', label: 'Open', color: 'bg-blue-500', generatedId: '1' } as BoardStage,
            { id: 'stage-won', label: 'Won', color: 'bg-green-500', linkedLifecycleStage: 'CUSTOMER', generatedId: '2' } as BoardStage,
        ],
    },
];

const mockDeals: DealView[] = [
    {
        id: 'deal-open',
        title: 'Open Deal',
        value: 1000,
        status: 'stage-open',
        boardId: 'board-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'user-1',
        isWon: false,
        isLost: false,
        owner: { name: 'Thales', avatar: '' },
        companyName: 'Acme',
    } as DealView,
    {
        id: 'deal-won',
        title: 'Won Deal (Recent)',
        value: 5000,
        status: 'stage-won',
        boardId: 'board-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(), // Recent
        ownerId: 'user-1',
        isWon: true,
        isLost: false,
        owner: { name: 'Thales', avatar: '' },
        companyName: 'Globex',
    } as DealView,
];

vi.mock('@/lib/query/hooks/useBoardsQuery', () => ({
    useBoards: () => ({ data: mockBoards, isLoading: false, isFetched: true }),
    useDefaultBoard: () => ({ data: mockBoards[0] }),
    useCreateBoard: () => ({ mutate: vi.fn() }),
    useUpdateBoard: () => ({ mutate: vi.fn() }),
    useDeleteBoard: () => ({ mutate: vi.fn() }),
    useDeleteBoardWithMove: () => ({ mutate: vi.fn() }),
    useCanDeleteBoard: () => ({ data: { canDelete: true, dealCount: 0 } }),
}));

vi.mock('@/lib/query/hooks/useDealsQuery', () => ({
    useDealsByBoard: () => ({ data: mockDeals, isLoading: false }),
}));

vi.mock('@/lib/query/hooks/useMoveDeal', () => ({
    useMoveDeal: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/lib/query/hooks/useActivitiesQuery', () => ({
    useCreateActivity: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/lib/realtime/useRealtimeSync', () => ({
    useRealtimeSyncKanban: vi.fn(),
}));

vi.mock('@/hooks/usePersistedState', () => ({
    usePersistedState: (key: string, initial: any) => [initial, vi.fn()], // Mock simple state
}));


describe('useBoardsController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should filter out Won/Lost deals when statusFilter is "open" (default)', async () => {
        const { result } = renderHook(() => useBoardsController());

        // Wait for data to resolve if needed (though mocks are sync here, hooks might have effects)
        await waitFor(() => {
            expect(result.current.boards).toHaveLength(1);
        });

        // Check filteredDeals - default statusFilter is 'open', so Won deals should NOT appear
        const deals = result.current.filteredDeals;

        // Validate we only have the open deal
        expect(deals).toHaveLength(1);
        expect(deals.find(d => d.id === 'deal-open')).toBeDefined();

        // Won deals should NOT be visible with default filter 'open'
        const wonDeal = deals.find(d => d.id === 'deal-won');
        expect(wonDeal).toBeUndefined();
    });
});
