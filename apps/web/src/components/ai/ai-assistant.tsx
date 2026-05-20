'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, X, Send, Mic, MicOff, Square, ChevronDown,
  RefreshCw, Copy, ThumbsUp, ThumbsDown, Minimize2, Maximize2,
  Zap, FileText, CheckSquare, BarChart2, Languages,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAiAssistantStore } from '@/stores/ai-assistant.store';
import { api } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

const QUICK_ACTIONS = [
  { label: 'Generate tasks', icon: CheckSquare, prompt: 'Help me generate tasks for my current project' },
  { label: 'Write document', icon: FileText, prompt: 'Help me write a document or wiki page' },
  { label: 'Analyze project', icon: BarChart2, prompt: 'Analyze my project progress and give me insights' },
  { label: 'Translate text', icon: Languages, prompt: 'Translate text to another language' },
  { label: 'Automate workflow', icon: Zap, prompt: 'Suggest automations for my workflow' },
];

export function AiAssistant() {
  const { isOpen, isMinimized, toggle, toggleMinimize } = useAiAssistantStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chatMutation = useMutation({
    mutationFn: (messages: Array<{ role: 'user' | 'assistant'; content: string }>) =>
      api.post<{ data: string }>('/ai/chat', { messages }),
    onSuccess: (response, _, context) => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.data.data,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: () => toast.error('AI assistant is unavailable'),
  });

  const sendMessage = useCallback(async (content = input) => {
    if (!content.trim() || chatMutation.isPending) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    const historyForApi = [...messages, userMessage]
      .slice(-10)
      .map(({ role, content }) => ({ role, content }));

    chatMutation.mutate(historyForApi);
  }, [input, messages, chatMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const copyMessage = (content: string) => {
    void navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={cn(
            'fixed bottom-6 right-6 z-50 flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden',
            isExpanded ? 'w-[600px] h-[80vh]' : 'w-96 h-[560px]',
            isMinimized && 'h-14',
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-purple-500/10">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Nexus AI</p>
              <p className="text-xs text-muted-foreground">Powered by GPT-4o & Claude</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleMinimize}>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isMinimized && 'rotate-180')} />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggle}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages area */}
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                {messages.length === 0 ? (
                  <WelcomeScreen onQuickAction={(prompt) => void sendMessage(prompt)} />
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        onCopy={() => copyMessage(message.content)}
                      />
                    ))}
                    {chatMutation.isPending && <TypingIndicator />}
                  </div>
                )}
              </ScrollArea>

              {/* Input area */}
              <div className="p-4 border-t border-border space-y-3">
                <div className="flex gap-2 items-end">
                  <div className="flex-1 relative">
                    <Textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask Nexus AI anything..."
                      className="min-h-[60px] max-h-[120px] resize-none pr-10 text-sm rounded-xl"
                      rows={2}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="icon"
                      variant={isRecording ? 'destructive' : 'outline'}
                      className="h-9 w-9 rounded-xl"
                      onClick={() => setIsRecording(!isRecording)}
                      title="Voice input"
                    >
                      {isRecording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="icon"
                      className="h-9 w-9 rounded-xl"
                      onClick={() => void sendMessage()}
                      disabled={!input.trim() || chatMutation.isPending}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function WelcomeScreen({ onQuickAction }: { onQuickAction: (prompt: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h3 className="font-semibold text-lg">Hi! I&apos;m Nexus AI</h3>
        <p className="text-sm text-muted-foreground">
          I can help you with tasks, documents, project insights, translation, and more.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick actions</p>
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => onQuickAction(action.prompt)}
            className="flex items-center gap-3 w-full p-3 rounded-xl border border-border hover:bg-accent hover:border-primary/20 transition-all text-left group"
          >
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <action.icon className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message, onCopy }: { message: Message; onCopy: () => void }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {!isUser && (
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
      )}

      <div className={cn('flex-1 space-y-1', isUser && 'items-end flex flex-col')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm max-w-[85%]',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted rounded-tl-sm',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser && (
          <div className="flex items-center gap-1 pl-1">
            <button onClick={onCopy} className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors" title="Copy">
              <Copy className="h-3 w-3" />
            </button>
            <button className="text-muted-foreground hover:text-green-500 p-1 rounded transition-colors" title="Good response">
              <ThumbsUp className="h-3 w-3" />
            </button>
            <button className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors" title="Bad response">
              <ThumbsDown className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
      </div>
      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
              animate={{ y: [-3, 0, -3] }}
              transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
