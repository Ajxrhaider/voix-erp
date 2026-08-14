import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { ClipboardList, CheckSquare } from 'lucide-react';

export default function WorkOrders() {
  const { workOrders, authFetch, refreshSystemData } = useContext(AppContext);
  const [fulfillOrder, setFulfillOrder] = useState(null);

  const activeOrders = workOrders.filter(w => w.status !== 'Fulfilled' && w.status !== 'Closed');

  const handleFulfill = async (e) => {
    e.preventDefault();
    await authFetch(`/api/tickets/work-orders/${fulfillOrder.id}/complete`, { method: 'PATCH', body: JSON.stringify({ leftover_materials: [] }) });
    setFulfillOrder(null);
    refreshSystemData();
  };

  return (
    <ModuleLayout
      title="Work Orders"
      subtitle="Dispatch tracking & Fulfillment"
      icon={<ClipboardList className="w-6 h-6" />}
    >
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-3">Work Order ID</th>
              <th className="p-3">Linked Ticket / Deployment</th>
              <th className="p-3">Assigned Team</th>
              <th className="p-3">Objective & Location</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeOrders.map(wo => (
              <tr key={wo.id} className="hover:bg-slate-50">
                <td className="p-3 font-mono font-bold text-amber-700">{wo.id}</td>
                <td className="p-3 font-mono text-xs">{wo.ticket_id || wo.deployment_id || 'N/A'}</td>
                <td className="p-3 font-bold text-slate-800">{wo.team_id}</td>
                <td className="p-3">
                  <p className="font-bold text-slate-900">{wo.objective}</p>
                  <p className="text-xs text-slate-500">{wo.location}</p>
                </td>
                <td className="p-3 text-center"><span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-bold">{wo.status}</span></td>
                <td className="p-3 text-right">
                  <button onClick={() => setFulfillOrder(wo)} className="bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-emerald-500 inline-flex items-center gap-1">
                    <CheckSquare className="w-4 h-4"/> Fulfill
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fulfillOrder && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-lg mb-2">Fulfill Work Order</h3>
            <p className="text-sm text-slate-600 mb-4">Marking <strong>{fulfillOrder.id}</strong> as fulfilled will notify the NOC to close the ticket.</p>
            <form onSubmit={handleFulfill}>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setFulfillOrder(null)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded font-bold">Mark Fulfilled</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}