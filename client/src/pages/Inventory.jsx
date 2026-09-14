import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { PackageSearch, Plus, ArrowRightSquare } from 'lucide-react';

export default function Inventory() {
  const { inventory, requisitions, authFetch, refreshSystemData, hasRole } = useContext(AppContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ item_name: '', category: 'Active Equipment', qty: '', unit_cost: '', min_alert_qty: 5 });

  const pendingIssuances = requisitions.filter(r => r.approval_stage === 'Pending Inventory' && r.type === 'Materials');

  const handleAddItem = async (e) => {
    e.preventDefault();
    await authFetch('/api/inventory', { method: 'POST', body: JSON.stringify(formData) });
    setIsModalOpen(false);
    refreshSystemData();
  };

  const handleIssueMaterials = async (id) => {
    await authFetch(`/api/inventory/requisitions/${id}/approve`, { method: 'PATCH' });
    alert("Materials successfully issued and allocated to the Work Order.");
    refreshSystemData();
  };

  return (
    <ModuleLayout
      title="Master Inventory"
      subtitle="Stock control & Operations"
      icon={<PackageSearch className="w-6 h-6" />}
      headerActions={
        hasRole(['Accounting']) && (
          <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm"><Plus className="w-4 h-4"/> Add Stock (Auto-Expense)</button>
        )
      }
    >
      {pendingIssuances.length > 0 && hasRole(['Inventory', 'Management', 'GM', 'Dev']) && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-5">
          <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2"><ArrowRightSquare className="w-5 h-5"/> Pending Material Issuances</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {pendingIssuances.map(req => (
              <div key={req.id} className="bg-white p-4 rounded-lg shadow-sm border border-blue-100 flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <p className="font-mono text-xs font-bold text-slate-500 mb-1">{req.id}</p>
                  <p className="font-bold text-slate-900 text-sm">{req.purpose}</p>
                  {req.work_order_id && <p className="text-xs font-bold text-blue-600 mt-1">Linked WO: {req.work_order_id}</p>}
                  <ul className="mt-2 text-xs font-mono text-slate-600 bg-slate-50 p-2 rounded">
                    {JSON.parse(req.materials_list || '[]').map((m, i) => <li key={i}>• {m.qty}x {m.itemName}</li>)}
                  </ul>
                </div>
                <div className="flex items-end">
                  <button onClick={() => handleIssueMaterials(req.id)} className="bg-slate-900 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition w-full sm:w-auto whitespace-nowrap shadow-sm">Issue Materials</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto w-full">
        <table className="w-full text-left text-sm min-w-[600px]">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-3">Item ID</th>
              <th className="p-3">Hardware / Material Name</th>
              <th className="p-3">Category</th>
              <th className="p-3 text-right">Stock Qty</th>
              <th className="p-3 text-right">Unit Cost</th>
              <th className="p-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inventory.map(item => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="p-3 font-mono font-bold text-slate-500 whitespace-nowrap">{item.id}</td>
                <td className="p-3 font-bold text-slate-900">{item.item_name}</td>
                <td className="p-3 text-xs text-slate-600">{item.category}</td>
                <td className="p-3 text-right font-mono font-bold text-lg">{item.qty}</td>
                <td className="p-3 text-right font-mono text-slate-500 whitespace-nowrap">₦{item.unit_cost.toLocaleString()}</td>
                <td className="p-3 text-center whitespace-nowrap">
                  {item.qty <= item.min_alert_qty ? <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-[10px] font-bold">LOW STOCK</span> : <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">HEALTHY</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-md">
            <h3 className="font-bold text-lg mb-2">Procure New Stock</h3>
            <p className="text-[11px] sm:text-xs text-amber-600 font-bold mb-4">Strict Rule: You are authorized as Accounting. This action automatically posts the total cost to the Accounting Expense Ledger.</p>
            <form onSubmit={handleAddItem} className="space-y-3">
              <input type="text" required placeholder="Item Name" onChange={e => setFormData({...formData, item_name: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" />
              <select onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50">
                <option>Active Equipment</option><option>Passive Fiber</option><option>Drop Cable</option><option>Accessories</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" required placeholder="Quantity" onChange={e => setFormData({...formData, qty: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" />
                <input type="number" required placeholder="Cost/Unit (₦)" onChange={e => setFormData({...formData, unit_cost: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 sm:py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2.5 sm:py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold">Add & Post Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}