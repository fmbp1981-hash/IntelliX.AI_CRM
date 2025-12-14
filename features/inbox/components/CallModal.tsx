import React, { useState, useEffect } from 'react';
import { X, Phone, PhoneOff, Check, XCircle, Voicemail, Clock, FileText } from 'lucide-react';

interface CallModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: CallLogData) => void;
    contactName: string;
    contactPhone: string;
    suggestedTitle?: string;
}

export interface CallLogData {
    outcome: 'connected' | 'no_answer' | 'voicemail' | 'busy';
    duration: number; // in seconds
    notes: string;
    title: string;
}

export const CallModal: React.FC<CallModalProps> = ({
    isOpen,
    onClose,
    onSave,
    contactName,
    contactPhone,
    suggestedTitle = 'Ligação'
}) => {
    const [startTime] = useState<Date>(new Date());
    const [elapsedTime, setElapsedTime] = useState(0);
    const [outcome, setOutcome] = useState<CallLogData['outcome'] | null>(null);
    const [notes, setNotes] = useState('');
    const [title, setTitle] = useState(suggestedTitle);

    // Timer effect
    useEffect(() => {
        if (!isOpen) return;

        const interval = setInterval(() => {
            setElapsedTime(Math.floor((new Date().getTime() - startTime.getTime()) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [isOpen, startTime]);

    // Format time as MM:SS
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSave = () => {
        if (!outcome) return;

        onSave({
            outcome,
            duration: elapsedTime,
            notes,
            title
        });
        onClose();
    };

    const handleDiscard = () => {
        onClose();
    };

    if (!isOpen) return null;

    const outcomeOptions = [
        { id: 'connected', label: 'Atendeu', icon: Check, color: 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30' },
        { id: 'no_answer', label: 'Não atendeu', icon: XCircle, color: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30' },
        { id: 'voicemail', label: 'Caixa postal', icon: Voicemail, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30' },
        { id: 'busy', label: 'Ocupado', icon: PhoneOff, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30 hover:bg-slate-500/30' },
    ] as const;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleDiscard} />

            {/* Modal */}
            <div className="relative bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 p-4 border-b border-slate-700/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-yellow-500/20 rounded-xl">
                                <Phone size={20} className="text-yellow-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">{contactName}</h3>
                                <p className="text-xs text-slate-400">{contactPhone}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleDiscard}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Timer */}
                <div className="flex items-center justify-center py-6 bg-slate-800/50">
                    <div className="flex items-center gap-3 px-6 py-3 bg-slate-900 rounded-xl border border-slate-700/50">
                        <Clock size={18} className="text-yellow-400" />
                        <span className="text-2xl font-mono font-bold text-white tracking-wider">
                            {formatTime(elapsedTime)}
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Outcome Selection */}
                    <div>
                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">
                            Resultado da ligação
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {outcomeOptions.map(({ id, label, icon: Icon, color }) => (
                                <button
                                    key={id}
                                    onClick={() => setOutcome(id)}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all text-sm font-medium ${outcome === id
                                            ? color + ' ring-2 ring-current'
                                            : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:border-slate-600'
                                        }`}
                                >
                                    <Icon size={16} />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">
                            Título da atividade
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 text-sm"
                            placeholder="Ex: Ligação de follow-up"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <FileText size={12} />
                            Notas da ligação
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="O que foi discutido? Próximos passos?"
                            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 text-sm resize-none"
                            rows={3}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700/50 flex gap-2">
                    <button
                        onClick={handleDiscard}
                        className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        Descartar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!outcome}
                        className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold bg-yellow-500 hover:bg-yellow-600 text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Check size={16} />
                        Salvar Log
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CallModal;
