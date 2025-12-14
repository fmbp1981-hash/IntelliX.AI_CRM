/**
 * @fileoverview Hook de Agente de IA (Non-Streaming)
 *
 * Hook que gerencia conversação com múltiplos provedores de IA (Google, OpenAI, Anthropic)
 * usando resposta completa (não streaming) para máxima compatibilidade.
 *
 * @module hooks/useAgent
 */

import { useState, useCallback, useEffect } from 'react';
import { CallOptions } from '@/types/ai';

/**
 * Anexo em mensagem do chat
 */
export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'audio';
  url: string;
  name?: string;
  mimeType?: string;
}

export interface ToolInvocation {
  state: 'partial-call' | 'call' | 'result';
  toolCallId: string;
  toolName: string;
  args: any;
  result?: any;
}

/**
 * Mensagem na conversa com a IA
 */
export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'data';
  content: string;
  attachments?: Attachment[];
  toolInvocations?: ToolInvocation[];
}

export type Message = AgentMessage;

interface UseAgentOptions {
  initialMessages?: AgentMessage[];
  system?: string;
  onFinish?: (message: AgentMessage) => void;
  id?: string;
  context?: CallOptions;
}

/**
 * Hook para gerenciar conversação com IA (Non-Streaming)
 */
export function useAgent({ initialMessages = [], system, onFinish, id, context }: UseAgentOptions = {}) {
  // Load from localStorage if id is provided
  const [messages, setMessages] = useState<Message[]>(() => {
    if (id) {
      const saved = localStorage.getItem(`chat_history_${id}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse chat history', e);
        }
      }
    }
    return initialMessages;
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Helper to generate unique IDs
  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Send message to AI
  const append = useCallback(
    async (content: string, attachments: Attachment[] = []) => {
      setInput('');
      setError(null);
      setIsLoading(true);

      // 1. Add user message optimistically
      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content,
        attachments,
      };

      setMessages(prev => [...prev, userMessage]);

      try {
        // 2. Call Next.js legacy AI endpoint (simple chat fallback)
        // Nota: este hook é legado e NÃO suporta ferramentas/aprovações.
        const response = await fetch('/api/ai/actions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            action: 'chatWithCRM',
            data: {
              message: content,
              context,
              // Mantemos o histórico para eventual uso futuro no server,
              // mas o handler atual pode ignorar.
              history: [...messages, userMessage],
              system,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `AI request failed: ${response.status}`);
        }

        const data = await response.json().catch(() => ({}));
        console.log('[useAgent] Response data:', data);

        if (data?.error) {
          throw new Error(data.error);
        }

        // 3. Add assistant message
        const assistantMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: data.result || '',
          // Sem ferramentas no fluxo legado.
        };

        setMessages(prev => [...prev, assistantMessage]);

        if (onFinish) {
          onFinish(assistantMessage);
        }
      } catch (err: any) {
        console.error('[useAgent] Error:', err);
        setError(err);

        // Add error message to chat
        const errorMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: `❌ Erro: ${err.message || 'Falha na comunicação com a IA'}`,
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, system, context, onFinish]
  );

  // Handle form submit
  const handleSubmit = useCallback(
    (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.();
      if (!input.trim()) return;
      append(input);
    },
    [input, append]
  );

  // Persistence
  useEffect(() => {
    if (id && messages.length > 0) {
      localStorage.setItem(`chat_history_${id}`, JSON.stringify(messages));
    }
  }, [messages, id]);

  // Placeholder for addToolResult (not used in non-streaming mode)
  const addToolResult = useCallback((_params: { toolCallId: string; result: any }) => {
    console.warn('[useAgent] addToolResult is a no-op in non-streaming mode');
  }, []);

  return {
    messages,
    input,
    setInput,
    append,
    handleSubmit,
    isLoading,
    error,
    setMessages,
    addToolResult,
  };
}
