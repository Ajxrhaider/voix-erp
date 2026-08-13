import React, { useState, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { Network, ClipboardList, Package, Plus } from 'lucide-react';

export default function NOCModule() {
  const { workOrders, inventory, authFetch, refreshData } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('dispatch');

  // Inventory Form States
  const [invItem, setInvItem] = useState('');
  const [invQty, setInvQty] = useState('');
  
  // Work Order Form States
  const [woObjective, setWoObjective] = useState('');
  const [woTeam, setWoTeam] = useState('Team Alpha');

  const handleAddInventory = async (e) => {
    e.preventDefault();
    const newItem = {
      id: `INV-${Date.now().toString().slice(-4)}`,
      item: invItem, 
      qty: Number(invQty), 
      unit: 'pcs', 
      cost: 0
    };
    const res = await authFetch('/api/inventory', { 
      method: 'POST', 
      body: JSON.stringify(newItem) 
    });
    if (res.ok) { 
      setInvItem(''); 
      setInvQty(''); 
      refreshData(); 
    }
  };

  const handleAddWorkOrder = async (e) => {
    e.preventDefault();
    const newWo = {
      id: `WO-${Date.now().toString().slice(-4)}`,
      teamId: woTeam, 
      objective: woObjective, 
      status: 'Assigned'
    };
    const res = await authFetch('/api/work-orders', { 
      method: 'POST', 
      body: JSON.stringify(newWo) 
    });
    if (res.ok) { 
      setWoObjective(''); 
      refreshData(); 
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Navigation */}
      <div className="flex space-x-4 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('dispatch')}
          className={`pb-2 text-sm font-medium ${activeTab === 'dispatch' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
        >
          Dispatch & Work Orders
        </button>
        <button 
          onClick={() => setActiveTab('warehouse')}
          className={`pb-2 text-sm font-medium ${activeTab === 'warehouse' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
        >
          Warehouse Inventory
        </button>
      </div>

      {activeTab === 'dispatch' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Work Order */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-600" /> Dispatch Team
            </h3>
            <form onSubmit={handleAddWorkOrder} className="space-y-4">
              <input type="text" placeholder="Objective (e.g. Repair Fiber Link)" required value={woObjective} onChange={e => setWoObjective(e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg text-sm" />
              <select value={woTeam} onChange={e => setWoTeam(e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg text-sm">
                <option>Team Alpha</option>
                <option>Team Bravo</option>
                <option>Team Charlie</option>
              </select>
              <button type="submit" className="w-full bg-blue-600 text-white font-medium py-2 rounded-lg text-sm hover:bg-blue-700">Assign Work Order</button>
            </form>
          </div>

          {/* List Work Orders */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">Active Deployments</h3>
            <div className="space-y-3">
              {workOrders.map(wo => (
                <div key={wo.id} className="p-3 border rounded-lg flex justify-between items-center text-sm">
                  <div>
                    <p className="font-bold text-slate-800">{wo.objective}</p>
                    <p className="text-xs text-slate-500">{wo.teamId}</p>
                  </div>
                  <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold">{wo.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Inventory Manager */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">Inventory Update</h3>
            <form onSubmit={handleAddInventory} className="space-y-4">
              <input type="text" placeholder="Item Name" required value={invItem} onChange={e => setInvItem(e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg text-sm" />
              <input type="number" placeholder="Quantity" required value={invQty} onChange={e => setInvQty(e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg text-sm" />
              <button type="submit" className="w-full bg-slate-800 text-white font-medium py-2 rounded-lg text-sm hover:bg-black">Add to Warehouse</button>
            </form>
          </div>
          {/* Stock Display */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">Warehouse Stock</h3>
            <div className="grid grid-cols-2 gap-3">
              {inventory.map(inv => (
                <div key={inv.id} className="p-3 border rounded-lg bg-slate-50 text-sm">
                  <p className="font-bold text-slate-800">{inv.item}</p>
                  <p className="text-xs text-slate-500">Qty: {inv.qty}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}