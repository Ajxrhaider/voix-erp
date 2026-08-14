import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { PackageSearch, Plus } from 'lucide-react';

export default function Inventory() {
  const { inventory, authFetch, refreshSystemData, user } = useContext(AppContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ item_name: '', category: 'Active Equipment', qty: '', unit_cost: '', min_alert_qty: 5 });

  const handleAddItem = async (e) => {
    e.preventDefault();
    await authFetch('/api/inventory', { method: 'POST', body: JSON.stringify(formData) });
    setIsModalOpen(false);
    refreshSystemData();
  };

  return (
    <ModuleLayout
      title="Master Inventory"
      subtitle="Stock control & Cost tracking"
      icon={<PackageSearch className="w-6 h-6" />}
      headerActions={
        ['Accounting', 'Management'].includes(user?.role) && (
          <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
            <Plus className="w-4 h-4"/> Add Stock (Expense)
          </button>
        )
      }
    >
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
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
                <td className="p-3 font-mono font-bold text-slate-500">{item.id}</td>
                <td className="p-3 font-bold text-slate-900">{item.item_name}</td>
                <td className="p-3 text-xs text-slate-600">{item.category}</td>
                <td className="p-3 text-right font-mono font-bold text-lg">{item.qty}</td>
                <td className="p-3 text-right font-mono text-slate-500">₦{item.unit_cost.toLocaleString()}</td>
                <td className="p-3 text-center">
                  {item.qty <= item.min_alert_qty ? 
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-[10px] font-bold">LOW STOCK</span> : 
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">HEALTHY</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-2">Procure New Stock</h3>
            <p className="text-xs text-amber-600 font-bold mb-4">Warning: This action automatically posts the total cost to the Accounting Expense Ledger.</p>
            <form onSubmit={handleAddItem} className="space-y-3">
              <input type="text" required placeholder="Item Name" onChange={e => setFormData({...formData, item_name: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <select onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border p-2 rounded text-sm bg-white">
                <option>Active Equipment</option><option>Passive Fiber</option><option>Drop Cable</option><option>Accessories</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" required placeholder="Quantity" onChange={e => setFormData({...formData, qty: e.target.value})} className="w-full border p-2 rounded text-sm" />
                <input type="number" required placeholder="Cost per Unit (₦)" onChange={e => setFormData({...formData, unit_cost: e.target.value})} className="w-full border p-2 rounded text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded font-bold">Add & Post Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}