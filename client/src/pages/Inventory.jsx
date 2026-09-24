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
        hasRole(['Accounting', 'Management', 'Admin', 'Dev']) && (
          <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm transition"><Plus className="w-4 h-4"/> Add Stock (Auto-Expense)</button>
        )
      }
    >
      {pendingIssuances.length > 0 && hasRole(['Inventory', 'Management', 'GM', 'Dev']) && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-5 w-full">
          <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2"><ArrowRightSquare className="w-5 h-5"/> Pending Material Issuances</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {pendingIssuances.map(req => (
              <div key={req.id} className="bg-white p-4 rounded-lg shadow-sm border border-blue-200 flex flex-col sm:flex-row justify-between gap-4">
                <div className="w-full overflow-hidden">
                  <p className="font-mono text-xs font-bold text-slate-600 mb-1">{req.id}</p>
                  <p className="font-bold text-slate-900 text-sm leading-tight">{req.purpose}</p>
                  {req.work_order_id && <p className="text-xs font-bold text-blue-800 mt-1">Linked WO: {req.work_order_id}</p>}
                  <ul className="mt-2 text-[11px] sm:text-xs font-mono text-slate-800 bg-slate-50 p-2 rounded w-full overflow-x-auto custom-scrollbar whitespace-nowrap border border-slate-200">
                    {JSON.parse(req.materials_list || '[]').map((m, i) => <li key={i} className="mb-1 font-bold">• {m.qty}x {m.itemName}</li>)}
                  </ul>
                </div>
                <div className="flex items-end shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 mt-1 sm:mt-0">
                  <button onClick={() => handleIssueMaterials(req.id)} className="bg-slate-900 hover:bg-blue-600 text-white px-4 py-2.5 sm:py-2 rounded-lg text-xs font-bold transition w-full sm:w-auto shadow-sm">Issue Materials</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto custom-scrollbar w-full">
        <table className="w-full text-left text-sm min-w-[600px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-3 text-slate-900 font-bold">Item ID</th>
              <th className="p-3 text-slate-900 font-bold">Hardware / Material Name</th>
              <th className="p-3 text-slate-900 font-bold">Category</th>
              <th className="p-3 text-right text-slate-900 font-bold">Stock Qty</th>
              <th className="p-3 text-right text-slate-900 font-bold">Unit Cost</th>
              <th className="p-3 text-center text-slate-900 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inventory.map(item => (
              <tr key={item.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-mono font-bold text-slate-600 whitespace-nowrap">{item.id}</td>
                <td className="p-3 font-bold text-slate-900">{item.item_name}</td>
                <td className="p-3 text-xs text-slate-700">{item.category}</td>
                <td className="p-3 text-right font-mono font-bold text-lg text-slate-900">{item.qty}</td>
                <td className="p-3 text-right font-mono text-slate-700 whitespace-nowrap">₦{item.unit_cost.toLocaleString()}</td>
                <td className="p-3 text-center whitespace-nowrap">
                  {item.qty <= item.min_alert_qty ? <span className="px-2 py-1 bg-red-100 text-red-900 rounded text-[10px] font-bold">LOW STOCK</span> : <span className="px-2 py-1 bg-emerald-100 text-emerald-900 rounded text-[10px] font-bold">HEALTHY</span>}
                </td>
              </tr>
            ))}
            {inventory.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-slate-600 font-medium">No items in inventory.</td></tr>}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <h3 className="font-bold text-lg mb-2 text-slate-900 border-b border-slate-200 pb-2">Procure New Stock</h3>
            <p className="text-[11px] sm:text-xs text-amber-900 font-bold mb-4 bg-amber-50 p-3 rounded-lg border border-amber-300 leading-tight">Strict Rule: You are authorized as Accounting. This action automatically posts the total cost to the Accounting Expense Ledger.</p>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Item Name</label><input type="text" required placeholder="Item Name" onChange={e => setFormData({...formData, item_name: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Category</label><select onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 font-bold"><option>Active Equipment</option><option>Passive Fiber</option><option>Drop Cable</option><option>Accessories</option></select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Quantity</label><input type="number" required placeholder="Qty" onChange={e => setFormData({...formData, qty: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400 font-mono font-bold" /></div>
                <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Cost/Unit (₦)</label><input type="number" required placeholder="Cost/Unit (₦)" onChange={e => setFormData({...formData, unit_cost: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400 font-mono font-bold" /></div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold px-4 py-2.5 sm:py-2 rounded-lg text-sm w-full sm:w-auto transition shadow-sm">Cancel</button>
                <button type="submit" className="px-4 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm shadow-sm w-full sm:w-auto transition">Add & Post Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}