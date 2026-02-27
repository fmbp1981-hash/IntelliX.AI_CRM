import React, { useState } from 'react';
import { useBulkMoveStage, useBulkDelete, useBulkExport } from '../hooks/useBulkOperations';
import { BoardStage } from '@/types';
import { CheckSquare, Trash2, Download, ArrowRight, X, Loader2 } from 'lucide-react';

interface BulkActionsBarProps {
    selectedIds: string[];
    stages: BoardStage[];
    onClearSelection: () => void;
}

export function BulkActionsBar({ selectedIds, stages, onClearSelection }: BulkActionsBarProps) {
    const { moveStage, isPending: isMoving } = useBulkMoveStage();
    const { deleteBulk, isPending: isDeleting } = useBulkDelete();
    const { exportCsv, isPending: isExporting } = useBulkExport();

    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [selectedStageId, setSelectedStageId] = useState<string>('');

    if (selectedIds.length === 0) return null;

    const handleMove = () => {
        if (!selectedStageId) return;
        moveStage(
            { dealIds: selectedIds, operation: 'move_stage', params: { stage_id: selectedStageId } },
            { onSuccess: onClearSelection }
        );
    };

    const handleDelete = () => {
        deleteBulk(
            { dealIds: selectedIds, operation: 'delete' },
            {
                onSuccess: () => {
                    setIsConfirmDeleteOpen(false);
                    onClearSelection();
                }
            }
        );
    };

    const handleExport = () => {
        exportCsv({ dealIds: selectedIds, operation: 'export_csv' });
    };

    const isLoading = isMoving || isDeleting || isExporting;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-slate-900/95 dark:bg-white/5 backdrop-blur-md px-6 py-3 rounded-2xl border border-slate-700 dark:border-white/10 shadow-2xl animate-in slide-in-from-bottom-5">

            <div className="flex items-center gap-3 pr-4 border-r border-slate-700/50 dark:border-white/10">
                <div className="flex bg-primary-500/20 text-primary-400 p-2 rounded-lg">
                    <CheckSquare className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                    <span className="text-white font-medium">{selectedIds.length} selecionados</span>
                    <button
                        onClick={onClearSelection}
                        className="text-xs text-slate-400 hover:text-white transition-colors text-left"
                    >
                        Limpar seleção
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-800/50 dark:bg-black/20 px-3 py-1.5 rounded-lg">
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                    <select
                        value={selectedStageId}
                        onChange={(e) => setSelectedStageId(e.target.value)}
                        className="bg-transparent text-sm text-slate-200 outline-none border-none py-1 min-w-[140px]"
                        disabled={isLoading}
                    >
                        <option value="" className="bg-slate-800">Mover estágio...</option>
                        {stages.map(s => (
                            <option key={s.id} value={s.id} className="bg-slate-800">{s.label}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleMove}
                        disabled={!selectedStageId || isLoading}
                        className="px-3 py-1 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
                    >
                        {(isLoading && isMoving) ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mover'}
                    </button>
                </div>

                <div className="w-px h-8 bg-slate-700/50 dark:bg-white/10 mx-2" />

                <button
                    onClick={handleExport}
                    disabled={isLoading}
                    className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 dark:hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2"
                    title="Export CSV"
                >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </button>

                {isConfirmDeleteOpen ? (
                    <div className="flex items-center gap-2 ml-2 bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20">
                        <span className="text-sm font-medium">Certeza?</span>
                        <button onClick={handleDelete} className="text-sm font-bold hover:text-red-300">Sim</button>
                        <button onClick={() => setIsConfirmDeleteOpen(false)} className="text-sm hover:text-white"><X className="w-4 h-4" /></button>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsConfirmDeleteOpen(true)}
                        disabled={isLoading}
                        className="p-2 text-slate-300 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors ml-2"
                        title="Excluir"
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                )}
            </div>
        </div>
    );
}
