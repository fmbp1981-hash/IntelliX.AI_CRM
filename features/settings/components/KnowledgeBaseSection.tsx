import React, { useState } from 'react';
import { BookOpen, FileText, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { useKnowledgeBase } from '../hooks/useKnowledgeBase';
import { useToast } from '@/context/ToastContext';

export const KnowledgeBaseSection: React.FC = () => {
    const { documents, isLoading, isError, addDocument, isAdding, removeDocument } = useKnowledgeBase();
    const { showToast } = useToast();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('faq');
    const [content, setContent] = useState('');
    const [url, setUrl] = useState('');
    const [sourceType, setSourceType] = useState('text');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type === 'application/pdf') {
            const reader = new FileReader();
            reader.onload = (event) => {
                const b64 = (event.target?.result as string).split(',')[1];
                setContent(b64);
                if (!title) {
                    setTitle(file.name.split('.')[0]);
                }
                setSourceType('pdf');
            };
            reader.readAsDataURL(file);
            return;
        }

        if (file.type !== 'text/plain' && !file.name.endsWith('.md') && !file.name.endsWith('.csv')) {
            showToast('Por favor, faça upload de arquivos de texto (.txt, .md, .csv) ou PDF (.pdf).', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            setContent(text);
            if (!title) {
                setTitle(file.name.split('.')[0]); // Usa o nome do arquivo sem extensão como título
            }
            setSourceType('file');
        };
        reader.readAsText(file);
    };

    const handleAdd = async () => {
        if (!title.trim() || (!content.trim() && !url.trim())) {
            showToast('Título e Conteúdo/URL são obrigatórios.', 'error');
            return;
        }

        try {
            await addDocument({ title, category, content, url, source_type: url ? 'url' : sourceType });
            setTitle('');
            setContent('');
            setUrl('');
            setCategory('faq');
            setIsFormOpen(false);
        } catch (error) {
            // Toast already handled by hook
            console.error(error);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-slate-500">Carregando Base de Conhecimento...</div>;
    }

    if (isError) {
        return (
            <div className="p-8 text-center text-red-500">
                <AlertCircle className="mx-auto h-8 w-8 mb-2" />
                Erro ao carregar documentos da base de conhecimento.
            </div>
        );
    }

    return (
        <div id="knowledge-base" className="mt-6 border-t border-slate-200 dark:border-white/10 pt-6 scroll-mt-8 space-y-6">

            <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg text-emerald-600 dark:text-emerald-400">
                        <BookOpen size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Base de Conhecimento (RAG)</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Faça o upload de documentos e instruções para a IA usar como contexto.</p>
                    </div>
                </div>

                {!isFormOpen && (
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <Plus size={16} /> Novo Documento
                    </button>
                )}
            </div>

            {/* Add Document Form */}
            {isFormOpen && (
                <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-6 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-md font-semibold text-slate-800 dark:text-slate-200">Adicionar à Base</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Título do Documento</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ex: Catálogo de Produtos 2026"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Categoria (RAG)</label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                >
                                    <option value="faq">FAQ / Dúvidas Frequentes</option>
                                    <option value="servicos">Serviços e Preços</option>
                                    <option value="equipe">Equipe e Especialistas</option>
                                    <option value="horarios">Regras e Horários</option>
                                    <option value="convenios">Convênios e Pagamento</option>
                                    <option value="imoveis">Catálogo de Imóveis (Descritivo)</option>
                                    <option value="vendas">Políticas de Vendas</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                    <span>Ou Raspe um Site (URL)</span>
                                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full dark:bg-emerald-900/30 dark:text-emerald-400">Novo</span>
                                </label>
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => {
                                        setUrl(e.target.value);
                                        if (e.target.value) setContent('');
                                        setSourceType('url');
                                    }}
                                    placeholder="https://sua-empresa.com.br/sobre"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Ou faça upload de Arquivo (.pdf, .txt, .md, .csv)</label>
                                <input
                                    type="file"
                                    accept=".pdf,.txt,.md,.csv"
                                    onChange={handleFileChange}
                                    className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-emerald-900/20 dark:file:text-emerald-400"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Conteúdo Manual</label>
                        <textarea
                            value={content}
                            onChange={(e) => {
                                setContent(e.target.value);
                                if (e.target.value) setUrl('');
                                setSourceType('text');
                            }}
                            disabled={!!url}
                            placeholder={url ? "O conteúdo da URL será extraído automaticamente..." : "Cole ou digite o texto aqui..."}
                            rows={8}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-y"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            Este texto será processado (embeddings) e usado como memória pelo Agente.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            onClick={() => {
                                setIsFormOpen(false);
                                setTitle('');
                                setContent('');
                            }}
                            className="px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleAdd}
                            disabled={isAdding || !title.trim() || (!content.trim() && !url.trim())}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            {isAdding ? 'Processando...' : 'Adicionar Documento'}
                        </button>
                    </div>
                </div>
            )}

            {/* Document List */}
            {documents.length === 0 && !isFormOpen ? (
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-xl p-8 text-center">
                    <FileText size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-slate-700 dark:text-slate-300 font-medium mb-1">Nenhum documento</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Adicione políticas, tabelas de preço, SOPs da empresa para o agente consultar automaticamente.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documents.map((doc) => (
                        <div key={doc.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm flex flex-col justify-between group hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400">
                                        <FileText size={20} />
                                    </div>
                                    {doc.is_active ?
                                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold uppercase rounded-full">Ativo</span>
                                        : <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase rounded-full">Inativo</span>
                                    }
                                </div>
                                <h4 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-2">{doc.title}</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {new Date(doc.created_at).toLocaleDateString('pt-BR')} • {(doc as any).category || 'faq'}
                                </p>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => {
                                        if (confirm('Tem certeza que deseja remover este documento da base?')) {
                                            removeDocument(doc.id);
                                        }
                                    }}
                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                    title="Remover documento"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
