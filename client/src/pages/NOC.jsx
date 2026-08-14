import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { Activity, Wrench, AlertTriangle } from 'lucide-react';

export default function NOC() {
  const { tickets, authFetch, refreshSystemData, teams } = useContext(AppContext);
  const [convertTicket, setConvertTicket] = useState(null);
  const [woData, setWoData] = useState({ team_id: '', objective: '', location: '', assigned_materials: [] });

  const kpis = useMemo(() => [
    { title: "Critical Outages", value: tickets.filter(t => t.priority === 'Critical' && t.status === 'Open').length, colorClass: "text-red-600" },
    { title: "Technical Tickets", value: tickets.filter(t => ['Fiber Cut', 'LOS Red Light', 'High Loss'].includes(t.category)).length, colorClass: "text-amber-600" },
    { title: "Active Field Teams", value: teams.length, colorClass: "text-blue-600" }
  ], [tickets, teams]);

  const networkTickets = tickets.filter(t => ['Fiber Cut', 'LOS Red Light', 'High Loss'].includes(t.category) && t.status !== 'Closed');

  const handleDispatchWO = async (e) => {
    e.preventDefault();
    await authFetch(`/api/tickets/${convertTicket.id}/convert-to-work-order`, { method: 'POST', body: JSON.stringify(woData) });
    setConvertTicket(null);
    refreshSystemData();
  };

  return (
    <ModuleLayout
      title="NOC Operations"
      subtitle="Network monitoring, technical faults, and field dispatch"
      icon={<Activity className="w-6 h-6" />}
      kpis={kpis}
    >
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-3">Ticket ID</th>
              <th className="p-3">Fault Location / Client</th>
              <th className="p-3">Technical Category</th>
              <th className="p-3">Priority</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Dispatch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {networkTickets.map(t => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="p-3 font-mono font-bold text-slate-700">{t.id}</td>
                <td className="p-3 font-bold text-slate-900">{t.customer_name}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs border font-medium ${t.category === 'Fiber Cut' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100'}`}>
                    {t.category}
                  </span>
                </td>
                <td className="p-3"><span className={`text-xs font-bold ${t.priority === 'Critical' ? 'text-red-600 flex items-center gap-1' : 'text-amber-600'}`}>{t.priority === 'Critical' && <AlertTriangle className="w-3 h-3"/>} {t.priority}</span></td>
                <td className="p-3 text-center"><span className="px-2 py-1 bg-blue-50 text-blue-800 rounded text-xs font-bold">{t.status}</span></td>
                <td className="p-3 text-right">
                  {t.status === 'Open' && (
                    <button onClick={() => setConvertTicket(t)} className="bg-amber-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-amber-500 inline-flex items-center gap-1">
                      <Wrench className="w-3 h-3"/> Dispatch
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {convertTicket && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-2">Dispatch Work Order</h3>
            <p className="text-xs text-slate-500 mb-4">Assign fault <strong>{convertTicket.id}</strong> to a Fiber team.</p>
            <form onSubmit={handleDispatchWO} className="space-y-3">
              <select required onChange={e => setWoData({...woData, team_id: e.target.value})} className="w-full border p-2 rounded text-sm bg-white">
                <option value="">Select Active Daily Team...</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input type="text" required placeholder="Work Objective (e.g. Splice Core 4)" onChange={e => setWoData({...woData, objective: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <input type="text" required placeholder="Location Details" onChange={e => setWoData({...woData, location: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setConvertTicket(null)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-amber-600 text-white rounded font-bold">Issue Work Order</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}