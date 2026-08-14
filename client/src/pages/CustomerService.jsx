import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { Headset, Plus, CheckCircle } from 'lucide-react';

export default function CustomerService() {
  const { tickets, workOrders, authFetch, refreshSystemData, customers } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('tickets');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ customer_name: '', title: '', description: '', category: 'Billing Query', priority: 'Medium' });

  const kpis = useMemo(() => [
    { title: "Open CS Queries", value: tickets.filter(t => t.status === 'Open' && t.created_by_role === 'Customer Service').length, colorClass: "text-red-600" },
    { title: "Resolved Today", value: tickets.filter(t => t.status === 'Resolved').length, colorClass: "text-emerald-600" },
    { title: "Active Work Orders", value: workOrders.filter(w => w.status !== 'Closed').length, colorClass: "text-amber-600" }
  ], [tickets, workOrders]);

  const handleCreateQuery = async (e) => {
    e.preventDefault();
    await authFetch('/api/tickets', { method: 'POST', body: JSON.stringify(formData) });
    setIsModalOpen(false);
    refreshSystemData();
  };

  const handleCloseTicket = async (id) => {
    // Allows CS to close a ticket after Fiber team marks the Work Order as 'Fulfilled'
    await authFetch(`/api/tickets/${id}/close`, { method: 'PATCH' });
    refreshSystemData();
  };

  return (
    <ModuleLayout
      title="Customer Service"
      subtitle="Client relations, billing queries, and ticket resolution"
      icon={<Headset className="w-6 h-6" />}
      tabs={[{ id: 'tickets', label: 'My Active Queries' }, { id: 'workorders', label: 'Field Work Orders' }]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      kpis={kpis}
      headerActions={
        <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex gap-2">
          <Plus className="w-4 h-4"/> Log New Query
        </button>
      }
    >
      {activeTab === 'tickets' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-3">Ticket ID</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Issue Category</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.filter(t => t.status !== 'Closed').map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold text-slate-700">{t.id}</td>
                  <td className="p-3 font-bold text-slate-900">{t.customer_name}</td>
                  <td className="p-3">{t.category}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${t.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {t.status === 'Resolved' && (
                      <button onClick={() => handleCloseTicket(t.id)} className="bg-slate-900 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 inline-flex">
                        <CheckCircle className="w-3 h-3"/> Close Ticket
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Query Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Log Customer Query</h3>
            <form onSubmit={handleCreateQuery} className="space-y-3">
              <input type="text" required placeholder="Customer Name" onChange={e => setFormData({...formData, customer_name: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <input type="text" required placeholder="Issue Title" onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <select onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border p-2 rounded text-sm bg-white">
                <option>Billing Query</option><option>Relocation</option><option>Router Reconfiguration</option><option>General Query</option>
              </select>
              <textarea placeholder="Description" onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border p-2 rounded text-sm h-24" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded font-bold">Submit Query</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}