'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserCog, Plus, Search, Users, Calendar, Clock, Loader2, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  employeeId?: string;
  jobTitle?: string;
  department?: string;
  status: string;
  startDate?: string;
  leaveBalance?: number;
  user: { displayName: string; email: string; avatarUrl?: string };
}

const DEPT_COLORS: Record<string, string> = {
  Engineering: 'bg-blue-100 text-blue-700',
  Design: 'bg-purple-100 text-purple-700',
  Marketing: 'bg-pink-100 text-pink-700',
  Sales: 'bg-green-100 text-green-700',
  HR: 'bg-yellow-100 text-yellow-700',
  Finance: 'bg-orange-100 text-orange-700',
  Operations: 'bg-teal-100 text-teal-700',
};

export default function HRPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'directory' | 'leaves'>('directory');

  useEffect(() => {
    api.get<{ data: { employees: Employee[] } }>('/hr/employees')
      .then(r => setEmployees(r.data.data.employees ?? []))
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = employees.filter(e =>
    e.user.displayName.toLowerCase().includes(search.toLowerCase()) ||
    e.department?.toLowerCase().includes(search.toLowerCase()) ||
    e.jobTitle?.toLowerCase().includes(search.toLowerCase())
  );

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">HR</h1>
          <p className="text-muted-foreground text-sm mt-1">People management and HR operations</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Add Employee
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Employees', value: employees.length, icon: Users },
          { label: 'Departments', value: departments.length, icon: Briefcase },
          { label: 'Active', value: employees.filter(e => e.status === 'ACTIVE').length, icon: UserCog },
          { label: 'On Leave', value: employees.filter(e => e.status === 'ON_LEAVE').length, icon: Calendar },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['directory', 'leaves'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize',
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'directory' ? 'Employee Directory' : 'Leave Management'}
          </button>
        ))}
      </div>

      {tab === 'directory' && (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <UserCog className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">{search ? 'No employees found' : 'No employees yet'}</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {search ? 'Try a different search.' : 'Add employees to manage your HR records.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((employee, i) => (
                <motion.div
                  key={employee.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-11 w-11 shrink-0">
                        <AvatarImage src={employee.user.avatarUrl ?? ''} />
                        <AvatarFallback className="text-sm bg-primary text-primary-foreground">
                          {employee.user.displayName?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{employee.user.displayName}</p>
                        {employee.jobTitle && <p className="text-xs text-muted-foreground">{employee.jobTitle}</p>}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {employee.department && (
                            <Badge variant="outline" className={`text-xs ${DEPT_COLORS[employee.department] ?? 'bg-gray-100 text-gray-700'}`}>
                              {employee.department}
                            </Badge>
                          )}
                          <Badge variant={employee.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
                            {employee.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {employee.startDate && (
                      <div className="mt-3 pt-3 border-t border-border flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Joined {new Date(employee.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'leaves' && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">Leave Management</h3>
          <p className="text-muted-foreground text-sm mt-1">Leave requests and approvals will appear here.</p>
          <Button className="mt-4 gap-2"><Plus className="h-4 w-4" /> Request Leave</Button>
        </div>
      )}
    </div>
  );
}
