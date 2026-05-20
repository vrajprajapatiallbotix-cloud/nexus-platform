'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, FolderKanban, Search, MoreHorizontal, CheckSquare, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority: string;
  progress: number;
  color?: string;
  icon?: string;
  _count: { tasks: number; members: number };
  members: Array<{ user: { id: string; displayName: string; avatarUrl?: string } }>;
  startDate?: string;
  endDate?: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-600 border-green-200',
  PLANNING: 'bg-blue-500/10 text-blue-600 border-blue-200',
  ON_HOLD: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
  COMPLETED: 'bg-gray-500/10 text-gray-600 border-gray-200',
  CANCELLED: 'bg-red-500/10 text-red-600 border-red-200',
};

const PROJECT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

function fetchProjects(): Promise<Project[]> {
  return api.get('/projects').then(r => {
    const d = (r.data as any)?.data ?? r.data;
    return Array.isArray(d) ? d : (d?.projects ?? []);
  });
}

export default function ProjectsPage() {
  const [search, setSearch] = useState('');

  const { data: projects = [], isLoading: loading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search projects..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <FolderKanban className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">{search ? 'No projects found' : 'No projects yet'}</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs">
            {search ? 'Try a different search term.' : 'Create your first project to start organizing work.'}
          </p>
          {!search && (
            <Button className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> New Project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <ProjectCard project={project} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const color = project.color ?? PROJECT_COLORS[Math.abs(project.id.charCodeAt(0)) % PROJECT_COLORS.length];

  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: color + '20', color }}>
            {project.icon ?? <FolderKanban className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <Link href={`/projects/${project.id}/board`} className="font-semibold hover:underline truncate block">
              {project.name}
            </Link>
            <Badge variant="outline" className={`text-xs mt-0.5 ${STATUS_COLORS[project.status] ?? ''}`}>
              {project.status?.replace('_', ' ') ?? 'ACTIVE'}
            </Badge>
          </div>
        </div>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {project.description && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
      )}

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>Progress</span>
          <span>{project.progress ?? 0}%</span>
        </div>
        <Progress value={project.progress ?? 0} className="h-1.5" />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <CheckSquare className="h-3.5 w-3.5" />
            {project._count?.tasks ?? 0} tasks
          </span>
          {project.endDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <div className="flex items-center -space-x-1.5">
          {(project.members ?? []).slice(0, 4).map(m => (
            <Avatar key={m.user.id} className="h-6 w-6 border-2 border-card">
              <AvatarImage src={m.user.avatarUrl ?? ''} />
              <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                {m.user.displayName?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
          {(project._count?.members ?? 0) > 4 && (
            <div className="h-6 w-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] text-muted-foreground">
              +{project._count.members - 4}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
