import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { Server, ShieldAlert, Database } from 'lucide-react';

export default function Admin() {
  const { user } = useContext(AppContext);

  return (
    <ModuleLayout
      title="IT Admin Center"
      subtitle="System configurations, backend health, and database audits"
      icon={<Server className="w-6 h-6" />}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 text-white p-6 rounded-xl shadow-md border border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-6 h-6 text-emerald-400" />
            <h3 className="font-bold text-lg">Database Architecture (SQLite)</h3>
          </div>
          <div className="space-y-2 font-mono text-sm text-slate-300">
            <p className="flex justify-between"><span>Status:</span> <span className="text-emerald-400">ONLINE (WAL Mode)</span></p>
            <p className="flex justify-between"><span>Active Sequences:</span> <span>10 Active Generators</span></p>
            <p className="flex justify-between"><span>Last Backup:</span> <span>Automated Daily</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <ShieldAlert className="w-6 h-6 text-amber-600" />
            <h3 className="font-bold text-lg text-slate-900">Security & Access Log</h3>
          </div>
          <p className="text-sm text-slate-600">
            Current Session Token belongs to <strong>{user?.fullname}</strong> ({user?.id}). 
            Role-Based Access Control (RBAC) is actively enforcing JWT boundary limits across 14 modules.
          </p>
        </div>
      </div>
    </ModuleLayout>
  );
}