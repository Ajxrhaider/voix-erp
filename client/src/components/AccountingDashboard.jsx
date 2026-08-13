import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { Landmark, Box, Banknote, ShieldCheck } from 'lucide-react';

export default function AccountingDashboard() {
  const { inventory, requisitions, ledger, authFetch } = useContext(AppContext);

  const [invName, setInvName] = useState('');
  const [invQty, setInvQty] = useState('');
  const [invCost, setInvCost] = useState('');

  const [reqType, setReqType] = useState('Cash');
  const [reqDept, setReqDept] = useState('NOC');
  const [reqPurp, setReqPurp] = useState('');
  const [reqAmt, setReqAmt] = useState('');

  const handleStockItem = async (e) => {
    e.preventDefault();
    await authFetch('/api/inventory', {
      method: 'POST',
      body: JSON.stringify({ name: invName, qty: parseInt(invQty), costPerUnit: parseFloat(invCost) })
    });
    setInvName(''); setInvQty(''); setInvCost('');
  };

  const handleCreateRequisition = async (e) => {
    e.preventDefault();
    await authFetch('/api/requisitions', {
      method: 'POST',
      body: JSON.stringify({ type: reqType, department: reqDept, purpose: reqPurp, amount: parseFloat(reqAmt) })
    });
    setReqPurp(''); setReqAmt('');
  };

  const handleReviewRequisition = async (reqId, action) => {
    await authFetch(`/api/requisitions/${reqId}/review`, {
      method: 'PUT',
      body: JSON.stringify({ action }) // 'Approved' or 'Rejected'
    });
  };

  return (
    <div className="space-y-6 text-xs font-sans">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Col 1: Material Restock & Req Filing */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg">
            <h3 className="font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 text-[11px] flex items-center gap-1.5">
              <Box className="w-4 h-4 text-emerald-400" /> Enterprise Inventory Injection
            </h3>
            <form onSubmit={handleStockItem} className="space-y-2.5">
              <input type="text" required placeholder="Nomenclature / Item Name" value={invName} onChange={e => setInvName(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" required placeholder="Quantity" value={invQty} onChange={e => setInvQty(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white font-mono" />
                <input type="number" required placeholder="Cost Per Unit" value={invCost} onChange={e => setInvCost(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white font-mono" />
              </div>
              <button type="submit" className="w-full py-2 bg-emerald-900/50 hover:bg-emerald-800/80 text-emerald-300 font-bold rounded uppercase tracking-wider border border-emerald-800 transition">Log Stock (Affects Ledger)</button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg">
            <h3 className="font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 text-[11px] flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-indigo-400" /> Requisition Filing Form
            </h3>
            <form onSubmit={handleCreateRequisition} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <select value={reqType} onChange={e => setReqType(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white">
                  <option value="Cash">Fiat / Cash</option>
                  <option value="Material">Warehouse Material</option>
                </select>
                <select value={reqDept} onChange={e => setReqDept(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white">
                  <option value="NOC">NOC</option>
                  <option value="Fiber">Fiber Crew</option>
                  <option value="Sales">Sales Office</option>
                </select>
              </div>
              <textarea required placeholder="Operational Purpose" value={reqPurp} onChange={e => setReqPurp(e.target.value)} rows="2" className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white text-[11px]" />
              {reqType === 'Cash' && (
                <input type="number" required placeholder="Total Amount Requested" value={reqAmt} onChange={e => setReqAmt(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white font-mono" />
              )}
              <button type="submit" className="w-full py-2 bg-indigo-900/50 hover:bg-indigo-800/80 text-indigo-300 font-bold rounded uppercase tracking-wider border border-indigo-800 transition">Submit to General Manager</button>
            </form>
          </div>
        </div>

        {/* Col 2: Approval Desk & Stock Matrix */}
        <div className="xl:col-span-8 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[320px] shadow-lg">
            <h3 className="font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-400" /> Pending Requisition Review Array
            </h3>
            <div className="pt-3 flex-1 overflow-y-auto pr-1 space-y-2">
              {requisitions.filter(r => r.status === 'Pending').map(req => (
                <div key={req.id} className="bg-slate-950 border border-slate-850 rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <span className="font-mono text-teal-400 font-bold text-[11px]">{req.id}</span>
                    <p className="text-white mt-0.5">{req.purpose}</p>
                    <p className="text-slate-500 font-mono text-[9px] mt-0.5">Dept: {req.department} • {req.type === 'Cash' ? `₦${req.amount}` : 'Material'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleReviewRequisition(req.id, 'Rejected')} className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-400 rounded font-bold uppercase text-[10px]">Deny</button>
                    <button onClick={() => handleReviewRequisition(req.id, 'Approved')} className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded font-bold uppercase text-[10px]">Authorize</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
             <h3 className="font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 text-[11px] flex items-center gap-1.5">
              <Box className="w-4 h-4 text-emerald-400" /> Global Inventory State
            </h3>
            <div className="pt-3 grid grid-cols-2 md:grid-cols-4 gap-3 max-h-48 overflow-y-auto pr-1">
              {inventory.map(item => (
                <div key={item.id} className="bg-slate-950 border border-slate-850 rounded p-2 text-center">
                  <p className="font-mono text-[9px] text-slate-500 mb-1">{item.id}</p>
                  <p className="text-white font-bold truncate">{item.item_name}</p>
                  <p className="text-emerald-400 font-mono text-sm mt-1">{item.qty} <span className="text-[9px] text-slate-600">units</span></p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}