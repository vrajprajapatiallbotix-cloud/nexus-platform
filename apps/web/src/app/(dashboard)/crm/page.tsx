'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Database, Plus, Search, Phone, Mail, Building2, Loader2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  status: string;
  stage?: string;
  value?: number;
}

const STAGE_COLORS: Record<string, string> = {
  LEAD: 'bg-blue-100 text-blue-700',
  PROSPECT: 'bg-purple-100 text-purple-700',
  QUALIFIED: 'bg-yellow-100 text-yellow-700',
  PROPOSAL: 'bg-orange-100 text-orange-700',
  NEGOTIATION: 'bg-pink-100 text-pink-700',
  CLOSED_WON: 'bg-green-100 text-green-700',
  CLOSED_LOST: 'bg-red-100 text-red-700',
};

export default function CRMPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'contacts' | 'pipeline'>('contacts');

  useEffect(() => {
    api.get<{ data: { contacts: Contact[] } }>('/crm/contacts')
      .then(r => setContacts(r.data.data.contacts ?? []))
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = contacts.filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase())
  );

  const pipelineStages = ['LEAD', 'PROSPECT', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON'];
  const totalValue = contacts.reduce((s, c) => s + (c.value ?? 0), 0);

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CRM</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage contacts and sales pipeline</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Add Contact
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Contacts', value: contacts.length, icon: Database },
          { label: 'Active Deals', value: contacts.filter(c => !['CLOSED_WON', 'CLOSED_LOST'].includes(c.stage ?? '')).length, icon: TrendingUp },
          { label: 'Won Deals', value: contacts.filter(c => c.stage === 'CLOSED_WON').length, icon: TrendingUp },
          { label: 'Pipeline Value', value: `$${(totalValue / 1000).toFixed(0)}k`, icon: TrendingUp },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['contacts', 'pipeline'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize',
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'pipeline' ? 'Pipeline' : 'Contacts'}
          </button>
        ))}
      </div>

      {tab === 'contacts' && (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Database className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">{search ? 'No contacts found' : 'No contacts yet'}</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {search ? 'Try a different search.' : 'Add your first contact to start tracking leads.'}
              </p>
              {!search && <Button className="mt-4 gap-2"><Plus className="h-4 w-4" /> Add Contact</Button>}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {filtered.map((contact, i) => (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-4 px-6 py-4 border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="text-sm bg-primary text-primary-foreground">
                      {contact.firstName?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{contact.firstName} {contact.lastName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {contact.company && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{contact.company}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {contact.stage && (
                      <Badge variant="outline" className={`text-xs ${STAGE_COLORS[contact.stage] ?? ''}`}>
                        {contact.stage.replace('_', ' ')}
                      </Badge>
                    )}
                    {contact.value && (
                      <span className="text-sm font-medium">${contact.value.toLocaleString()}</span>
                    )}
                    <div className="flex gap-1">
                      {contact.email && (
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {contact.phone && (
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Phone className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'pipeline' && (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-[900px]">
            {pipelineStages.map(stage => {
              const stageContacts = contacts.filter(c => c.stage === stage);
              return (
                <div key={stage} className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {stage.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-muted-foreground">{stageContacts.length}</span>
                  </div>
                  <div className="space-y-2">
                    {stageContacts.map(c => (
                      <div key={c.id} className="bg-card border border-border rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer">
                        <p className="text-sm font-medium truncate">{c.firstName} {c.lastName}</p>
                        {c.company && <p className="text-xs text-muted-foreground">{c.company}</p>}
                        {c.value && <p className="text-xs font-semibold text-primary mt-1">${c.value.toLocaleString()}</p>}
                      </div>
                    ))}
                    {stageContacts.length === 0 && (
                      <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                        <p className="text-xs text-muted-foreground">No contacts</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
