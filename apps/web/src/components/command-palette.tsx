'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog, DialogContent,
} from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="fixed top-24 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden p-0">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            autoFocus
            placeholder="Search tasks, projects, docs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent"
          />
          <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded border text-muted-foreground">Esc</kbd>
        </div>
        <div className="p-4 text-sm text-muted-foreground text-center">
          {query ? `Searching for "${query}"…` : 'Type to search across your workspace'}
        </div>
      </DialogContent>
    </Dialog>
  );
}
