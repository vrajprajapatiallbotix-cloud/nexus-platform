'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus, Search, Folder, Clock, Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

interface Doc {
  id: string;
  title: string;
  type: string;
  updatedAt: string;
  author?: { displayName: string; avatarUrl?: string };
  workspace?: { name: string };
  isPublic: boolean;
  tags?: string[];
}

export default function DocsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get<{ data: { documents: Doc[] } }>('/documents')
      .then(r => setDocs(r.data.data.documents ?? []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = docs.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase())
  );

  const recent = filtered.slice(0, 4);

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Docs & Wiki</h1>
          <p className="text-muted-foreground text-sm mt-1">Team knowledge base and documentation</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New Doc
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search docs..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">{search ? 'No docs found' : 'No documents yet'}</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs">
            {search ? 'Try a different search.' : 'Create your first document to start building your team wiki.'}
          </p>
          {!search && (
            <Button className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> New Document
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {!search && recent.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Recent</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recent.map((doc, i) => (
                  <motion.div key={doc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <DocCard doc={doc} />
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center gap-2 mb-4">
              <Folder className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                {search ? 'Results' : 'All Documents'}
              </h2>
            </div>
            <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
              {filtered.map(doc => <DocRow key={doc.id} doc={doc} />)}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function DocCard({ doc }: { doc: Doc }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-shadow cursor-pointer group">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate group-hover:text-primary transition-colors">{doc.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Updated {new Date(doc.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
}

function DocRow({ doc }: { doc: Doc }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-card hover:bg-accent/50 transition-colors cursor-pointer">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="flex-1 text-sm font-medium truncate">{doc.title}</span>
      <div className="flex items-center gap-3 shrink-0">
        {doc.isPublic && <Badge variant="outline" className="text-xs">Public</Badge>}
        <span className="text-xs text-muted-foreground hidden sm:block">
          {new Date(doc.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        {doc.author && (
          <Avatar className="h-6 w-6">
            <AvatarImage src={doc.author.avatarUrl ?? ''} />
            <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
              {doc.author.displayName?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
