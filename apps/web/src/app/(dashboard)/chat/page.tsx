'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, Plus, Send, Smile, Paperclip, Search, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Channel {
  id: string;
  name: string;
  type: string;
  description?: string;
  _count?: { messages: number };
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; displayName: string; avatarUrl?: string };
}

export default function ChatPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [message, setMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<{ data: { channels: Channel[] } }>('/chat/channels')
      .then(r => {
        const ch = r.data.data.channels ?? [];
        setChannels(ch);
        if (ch.length > 0) setActiveChannel(ch[0]);
      })
      .catch(() => setChannels([]))
      .finally(() => setLoadingChannels(false));
  }, []);

  useEffect(() => {
    if (!activeChannel) return;
    setLoadingMessages(true);
    api.get<{ data: { messages: Message[] } }>(`/chat/channels/${activeChannel.id}/messages`)
      .then(r => setMessages(r.data.data.messages ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
  }, [activeChannel?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!message.trim() || !activeChannel) return;
    const text = message.trim();
    setMessage('');
    try {
      await api.post(`/chat/channels/${activeChannel.id}/messages`, { content: text });
    } catch { /* ignore */ }
  };

  return (
    <div className="flex h-full">
      {/* Channel list */}
      <div className="w-64 shrink-0 border-r border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Channels</h2>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8 h-8 text-xs" placeholder="Search channels" />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {loadingChannels ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : channels.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8 px-3">No channels yet</p>
            ) : (
              channels.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch)}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors',
                    activeChannel?.id === ch.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                  )}
                >
                  <Hash className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{ch.name}</span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Message area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeChannel ? (
          <>
            {/* Channel header */}
            <div className="h-14 border-b border-border flex items-center gap-3 px-6 shrink-0">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{activeChannel.name}</span>
              {activeChannel.description && (
                <span className="text-sm text-muted-foreground border-l border-border pl-3">{activeChannel.description}</span>
              )}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-6 py-4">
              {loadingMessages ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="font-medium">No messages yet</p>
                  <p className="text-sm text-muted-foreground">Be the first to say something in #{activeChannel.name}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map(msg => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border shrink-0">
              <div className="flex items-center gap-2 bg-muted rounded-xl px-4 py-2">
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder={`Message #${activeChannel.name}`}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                />
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <Smile className="h-4 w-4" />
                </button>
                <Button size="icon" className="h-7 w-7 rounded-lg" onClick={sendMessage} disabled={!message.trim()}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg">Select a channel</h3>
              <p className="text-sm text-muted-foreground">Choose a channel from the sidebar to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const time = new Date(message.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex items-start gap-3 group">
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        <AvatarImage src={message.user.avatarUrl ?? ''} />
        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
          {message.user.displayName?.[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{message.user.displayName}</span>
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        <p className="text-sm mt-0.5 break-words">{message.content}</p>
      </div>
    </div>
  );
}
