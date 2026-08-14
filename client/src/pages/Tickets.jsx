import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { HeadphonesIcon, Plus, Wrench } from 'lucide-react';

export default function Tickets() {
  const { tickets, authFetch, refreshSystemData, customers, teams } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('open');
  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false);
  const [convertTicket, setConvertTicket] = useState(null);
  
  const [formData, setFormData] = useState({ customer_name: '', title: '', description: '', category: 'General Query', priority: 'Medium' });
  const [woData, setWoData] = useState({ team_id: '', objective: '', location: '' });

  const kpis = useMemo(() => [
    { title: "Open Queries", value: tickets.filter(t => t.status === 'Open').length, colorClass: "text-red-600" },
    { title: "In Progress", value: tickets.filter(t => t.status === 'Converted to Work Order' || t.status === 'In Progress').length, colorClass: "text-amber-600" },
    { title: "Resolved", value: tickets.filter(t => t.status === 'Resolved').length, colorClass: "text-emerald-600" },
  ], [tickets]);

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    await authFetch('/api/tickets', { method: 'POST', body: JSON.stringify(formData) });
    setIsQueryModalOpen(false);
    refreshSystemData();
  };

  const handleConvertWO = async (e) => {
    e.preventDefault();
    await authFetch(`/api/tickets/${convertTicket.id}/convert-to-work-order`, { method: 'POST', body: JSON.stringify(woData) });
    setConvertTicket(null);
    refreshSystemData();
  };

  const filteredTickets = tickets.filter(t => activeTab === 'open' ? ['Open', 'In Progress', 'Converted to Work Order'].includes(t.status) : ['Resolved', 'Closed'].includes(t.status));

  return (
    <ModuleLayout
      title="NOC & CS Support Desk"
      subtitle="Manage technical queries and dispatch field teams"
      icon={<HeadphonesIcon className="w-6 h-6" />}
      tabs={[{ id: 'open', label: 'Active Queries' }, { id: 'resolved', label: 'Resolved Tickets' }]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      kpis={kpis}
      headerActions={
        <button onClick={() => setIsQueryModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
          <Plus className="w-4 h-4"/> New Query
        </button>
      }
    >
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-3">Ticket ID</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Issue Category</th>
              <th className="p-3">Priority</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTickets.map(t => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="p-3 font-mono font-bold text-slate-700">{t.id}</td>
                <td className="p-3 font-bold text-slate-900">{t.customer_name}</td>
                <td className="p-3">
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-xs border font-medium">{t.category}</span>
                  <p className="text-xs text-slate-500 mt-1">{t.title}</p>
                </td>
                <td className="p-3"><span className={`text-xs font-bold ${t.priority === 'Critical' ? 'text-red-600' : 'text-amber-600'}`}>{t.priority}</span></td>
                <td className="p-3 text-center"><span className="px-2 py-1 bg-blue-50 text-blue-800 rounded text-xs font-bold">{t.status}</span></td>
                <td className="p-3 text-right">
                  {t.status === 'Open' && (
                    <button onClick={() => setConvertTicket(t)} className="bg-amber-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-amber-500 flex items-center gap-1 inline-flex">
                      <Wrench className="w-3 h-3"/> Dispatch Team
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isQueryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Log Customer Query</h3>
            <form onSubmit={handleCreateTicket} className="space-y-3">
              <input type="text" required placeholder="Customer Name" onChange={e => setFormData({...formData, customer_name: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <input type="text" required placeholder="Issue Title (e.g. Red LOS Light)" onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <select onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border p-2 rounded text-sm bg-white">
                <option>Fiber Cut</option><option>High Loss</option><option>LOS Red Light</option><option>Billing Query</option><option>General Query</option>
              </select>
              <select onChange={e => setFormData({...formData, priority: e.target.value})} className="w-full border p-2 rounded text-sm bg-white">
                <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
              </select>
              <textarea placeholder="Description" onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border p-2 rounded text-sm h-24" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsQueryModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded font-bold">Create Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {convertTicket && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-2">Dispatch Work Order</h3>
            <p className="text-xs text-slate-500 mb-4">Assign ticket <strong>{convertTicket.id}</strong> to a Fiber team.</p>
            <form onSubmit={handleConvertWO} className="space-y-3">
              <select required onChange={e => setWoData({...woData, team_id: e.target.value})} className="w-full border p-2 rounded text-sm bg-white">
                <option value="">Select Active Daily Team...</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name} (Lead: {t.leader_id})</option>)}
              </select>
              <input type="text" required placeholder="Work Objective" onChange={e => setWoData({...woData, objective: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <input type="text" required placeholder="Location Details" onChange={e => setWoData({...woData, location: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setConvertTicket(null)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-amber-600 text-white rounded font-bold">Dispatch Team</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}