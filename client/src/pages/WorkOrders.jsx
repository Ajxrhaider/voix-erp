import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { Wrench, Plus, CheckSquare, PackagePlus } from 'lucide-react';

export default function WorkOrders() {
  const { workOrders, inventory, teams, authFetch, refreshSystemData, hasRole } = useContext(AppContext);
  const [isMatReqModalOpen, setIsMatReqModalOpen] = useState(false);
  const [isFulfillModalOpen, setIsFulfillModalOpen] = useState(false);
  const [activeWO, setActiveWO] = useState(null);
  
  const [reqData, setReqData] = useState({ type: 'Materials', purpose: '', materials_list: [], work_order_id: '' });
  const [fulfillData, setFulfillData] = useState({ leftover_materials: [], return_to_inventory: true });
  
  const [selectedItem, setSelectedItem] = useState('');
  const [selectedQty, setSelectedQty] = useState('');

  const handleOpenReq = (wo) => {
    setActiveWO(wo);
    setReqData({ type: 'Materials', purpose: `Materials for ${wo.id}: ${wo.objective}`, materials_list: [], work_order_id: wo.id });
    setSelectedItem(''); setSelectedQty('');
    setIsMatReqModalOpen(true);
  };

  const handleAddMaterialToCart = (stateSetter, stateData, listKey) => {
    if (!selectedItem || !selectedQty) return;
    const invItem = inventory.find(i => i.id === selectedItem);
    const newEntry = { itemId: invItem.id, itemName: invItem.item_name, qty: parseInt(selectedQty) };
    stateSetter({ ...stateData, [listKey]: [...stateData[listKey], newEntry] });
    setSelectedItem(''); setSelectedQty('');
  };

  const handleSubmitReq = async (e) => {
    e.preventDefault();
    await authFetch('/api/inventory/requisitions', { method: 'POST', body: JSON.stringify(reqData) });
    setIsMatReqModalOpen(false);
    refreshSystemData();
    alert(`Materials Requisition generated for ${activeWO.id}. Pending HR/GM approval.`);
  };

  const handleFulfill = async (e) => {
    e.preventDefault();
    await authFetch(`/api/tickets/work-orders/${activeWO.id}/complete`, { method: 'PATCH', body: JSON.stringify(fulfillData) });
    setIsFulfillModalOpen(false);
    refreshSystemData();
  };

  return (
    <ModuleLayout
      title="Field Work Orders"
      subtitle="Track assigned dispatches and manage material allocations"
      icon={<Wrench className="w-6 h-6" />}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        {workOrders.map(wo => {
          const team = teams.find(t => t.id === wo.team_id);
          const mats = JSON.parse(wo.assigned_materials || '[]');
          
          return (
            <div key={wo.id} className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap justify-between items-start mb-2 gap-2">
                  <p className="font-mono text-[11px] sm:text-xs font-bold text-slate-500">{wo.id}</p>
                  <span className={`px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${wo.status === 'Fulfilled' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{wo.status}</span>
                </div>
                <h3 className="font-bold text-slate-900 text-base sm:text-lg mb-1 leading-tight">{wo.objective}</h3>
                <p className="text-xs sm:text-sm text-slate-600"><strong>Location:</strong> {wo.location}</p>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-2 font-semibold">Assigned Team: {team ? team.name : wo.team_id}</p>
                
                {mats.length > 0 && (
                  <div className="mt-3 bg-blue-50 border border-blue-100 p-2.5 sm:p-3 rounded-lg w-full overflow-x-auto custom-scrollbar">
                    <p className="text-[9px] sm:text-[10px] font-bold text-blue-900 uppercase tracking-wider mb-1">Issued Materials Attached</p>
                    <ul className="text-[11px] sm:text-xs text-blue-800 space-y-0.5 font-mono whitespace-nowrap">
                      {mats.map((m, i) => <li key={i}>• {m.qty}x {m.itemName}</li>)}
                    </ul>
                  </div>
                )}
              </div>
              
              {wo.status !== 'Fulfilled' && (
                <div className="flex flex-col lg:flex-row gap-2 mt-4 pt-4 border-t border-slate-100">
                  <button onClick={() => handleOpenReq(wo)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2.5 sm:py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 w-full"><PackagePlus className="w-3.5 h-3.5"/> Request Materials</button>
                  <button onClick={() => { setActiveWO(wo); setFulfillData({ leftover_materials: [], return_to_inventory: true }); setSelectedItem(''); setSelectedQty(''); setIsFulfillModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2.5 sm:py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 w-full shadow-sm"><CheckSquare className="w-3.5 h-3.5"/> Mark Fulfilled</button>
                </div>
              )}
            </div>
          );
        })}
        {workOrders.length === 0 && <p className="text-slate-500 p-4 w-full">No active work orders found.</p>}
      </div>

      {/* Materials Requisition Modal */}
      {isMatReqModalOpen && activeWO && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-base sm:text-lg border-b pb-2 mb-4 leading-tight">Requisition Materials for {activeWO.id}</h3>
            <form onSubmit={handleSubmitReq} className="space-y-4">
              <textarea required value={reqData.purpose} onChange={e => setReqData({...reqData, purpose: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50 h-20" placeholder="Justification..." />
              
              <div className="bg-slate-50 p-3 sm:p-4 rounded-lg border">
                <label className="text-[11px] sm:text-xs font-bold block mb-2 text-slate-700">Add Materials to Request List</label>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)} className="w-full border p-2.5 sm:p-2 rounded-lg sm:rounded text-sm bg-white">
                    <option value="">Select Inventory Item...</option>
                    {inventory.map(i => <option key={i.id} value={i.id}>{i.item_name} (Avail: {i.qty})</option>)}
                  </select>
                  <input type="number" min="1" placeholder="Qty" value={selectedQty} onChange={e => setSelectedQty(e.target.value)} className="w-full sm:w-20 border p-2.5 sm:p-2 rounded-lg sm:rounded text-sm" />
                </div>
                <button type="button" onClick={() => handleAddMaterialToCart(setReqData, reqData, 'materials_list')} className="w-full bg-blue-100 text-blue-800 font-bold py-2.5 sm:py-1.5 rounded-lg sm:rounded text-xs border border-blue-200">Add to List</button>
                
                {reqData.materials_list.length > 0 && (
                  <ul className="mt-3 text-[11px] sm:text-xs space-y-1 font-mono">
                    {reqData.materials_list.map((m, i) => <li key={i} className="flex justify-between border-b border-slate-200 pb-1"><span>{m.itemName}</span><span className="font-bold">x{m.qty}</span></li>)}
                  </ul>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t mt-2">
                <button type="button" onClick={() => setIsMatReqModalOpen(false)} className="px-4 py-2.5 sm:py-2 border rounded-lg text-sm font-medium w-full sm:w-auto">Cancel</button>
                <button type="submit" className="px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm w-full sm:w-auto">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fulfill Work Order Modal */}
      {isFulfillModalOpen && activeWO && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-base sm:text-lg border-b pb-2 mb-4">Complete Work Order {activeWO.id}</h3>
            <form onSubmit={handleFulfill} className="space-y-4">
              
              <div className="bg-amber-50 p-3 sm:p-4 rounded-lg border border-amber-200">
                <label className="text-[11px] sm:text-xs font-bold block mb-2 text-amber-900">Record Leftover Materials</label>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)} className="w-full border border-amber-300 p-2.5 sm:p-2 rounded-lg sm:rounded text-sm bg-white">
                    <option value="">Select Leftover Item...</option>
                    {inventory.map(i => <option key={i.id} value={i.id}>{i.item_name}</option>)}
                  </select>
                  <input type="number" min="1" placeholder="Qty" value={selectedQty} onChange={e => setSelectedQty(e.target.value)} className="w-full sm:w-20 border border-amber-300 p-2.5 sm:p-2 rounded-lg sm:rounded text-sm" />
                </div>
                <button type="button" onClick={() => handleAddMaterialToCart(setFulfillData, fulfillData, 'leftover_materials')} className="w-full bg-amber-200 text-amber-900 font-bold py-2.5 sm:py-1.5 rounded-lg sm:rounded text-xs shadow-sm">Log Leftover</button>
                
                {fulfillData.leftover_materials.length > 0 && (
                  <ul className="mt-3 text-[11px] sm:text-xs space-y-1 font-mono text-amber-900">
                    {fulfillData.leftover_materials.map((m, i) => <li key={i} className="flex justify-between border-b border-amber-200 pb-1"><span>{m.itemName}</span><span className="font-bold">x{m.qty}</span></li>)}
                  </ul>
                )}
                
                <div className="mt-4 sm:mt-3 flex items-start sm:items-center gap-2">
                  <input type="checkbox" checked={fulfillData.return_to_inventory} onChange={e => setFulfillData({...fulfillData, return_to_inventory: e.target.checked})} className="w-5 h-5 sm:w-4 sm:h-4 rounded text-emerald-600 mt-0.5 sm:mt-0"/>
                  <span className="text-[11px] sm:text-xs font-bold text-amber-900 leading-tight">Automatically Return Leftovers to Inventory Stock</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t mt-2">
                <button type="button" onClick={() => setIsFulfillModalOpen(false)} className="px-4 py-2.5 sm:py-2 border rounded-lg text-sm font-medium w-full sm:w-auto">Cancel</button>
                <button type="submit" className="px-4 py-2.5 sm:py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-sm w-full sm:w-auto">Mark Fulfilled</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}