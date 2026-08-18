import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { User, ClipboardList, Package, Check, AlertCircle } from 'lucide-react';

export default function FieldModule() {
  const { authFetch } = useContext(AppContext);
  const [workOrders, setWorkOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("TEAM-A");

  const fiberTeams = [
    { id: "TEAM-A", name: "Fiber Squad Alpha", members: ["Obi Nwosu", "Chidi Okafor"] },
    { id: "TEAM-B", name: "Fiber Squad Beta", members: ["Segun Oni", "Emeka Uzo"] }
  ];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const wRes = await authFetch('/api/work-orders');
      if (wRes.ok) setWorkOrders(await wRes.json());
      const iRes = await authFetch('/api/inventory');
      if (iRes.ok) setInventory(await iRes.json());
    } catch (err) { console.error(err); }
  };

  const handleStoreCheckout = async (wo) => {
    try {
      // 1. Deduct from Inventory Database
      await authFetch('/api/inventory/checkout', {
        method: 'POST',
        body: JSON.stringify({ materials: wo.materialsRequired })
      });
      // 2. Update Work Order Status
      await authFetch(`/api/work-orders/${wo.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Materials Checked Out' })
      });
      loadData();
      alert("Materials successfully withdrawn. Warehouse ledger updated.");
    } catch (err) { console.error(err); }
  };

  const handleFiberHandover = async (woId, ticketId) => {
    try {
      await authFetch(`/api/work-orders/${woId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Splicing Completed' })
      });
      await authFetch(`/api/installation-tickets/${ticketId}/step`, {
        method: 'PUT',
        body: JSON.stringify({ step: 5, notes: "Fiber Crew verified splicing. Handed over to NOC." })
      });
      loadData();
      alert("Splicing marked as complete! The NOC desk has been notified.");
    } catch (err) { console.error(err); }
  };

  const teamWOs = workOrders.filter(wo => wo.teamId === selectedTeam);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-slate-100 font-sans">
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2"><User className="w-5 h-5 text-teal-400" /><h3 className="text-lg font-bold text-white">Select Active Squad</h3></div>
          <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono font-bold">
            {fiberTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-sm">
          <h4 className="text-xs font-bold uppercase text-slate-400 mb-3 font-mono">Live Warehouse Stock Check</h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {inventory.map((inv) => (
              <div key={inv.id} className="bg-slate-955 p-2 rounded border border-slate-850">
                <span className="text-slate-500 text-[10px] truncate block">{inv.item}</span>
                <span className="font-mono text-slate-200 font-bold mt-1 block">{inv.qty} {inv.unit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-7 space-y-6">
        <h3 className="text-sm font-black uppercase text-slate-400 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-teal-400"/> Assigned Store Check-out</h3>
        
        {teamWOs.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
            <AlertCircle className="w-10 h-10 mx-auto mb-2" />
            <p>No pending Work Orders for this squad.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {teamWOs.map(wo => (
              <div key={wo.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
                <div className="flex justify-between items-start pb-3 border-b border-slate-855">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-400">#{wo.id} (Ticket: {wo.ticketId})</span>
                    <h4 className="text-sm font-bold text-white mt-1">{wo.objective}</h4>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${wo.status === 'Assigned' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-400'}`}>{wo.status}</span>
                </div>

                <div>
                  <span className="text-[10px] text-amber-500 uppercase font-mono block mb-2 font-bold">Materials Allocated:</span>
                  <div className="grid grid-cols-2 gap-2">
                    {wo.materialsRequired.map((mat, idx) => (
                      <div key={idx} className="bg-slate-955 p-2 rounded border border-slate-855 flex justify-between text-xs">
                        <span className="text-slate-400 truncate max-w-[120px]" title={mat.item}>{mat.item}</span>
                        <span className="font-black text-white font-mono">{mat.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* DAILY ACTIVITY REPORT - Add this inside your FieldModule return statement */}
                <div className="mt-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-4">End of Day Activity Report</h3>
                  <form className="grid grid-cols-1 md:grid-cols-3 gap-4" onSubmit={(e) => { e.preventDefault(); alert("Report submitted successfully."); }}>
                    <input type="date" className="border p-2 rounded text-sm w-full" required />
                    <input type="number" placeholder="Total Splices Made" className="border p-2 rounded text-sm w-full" required />
                    <input type="text" placeholder="Locations Covered" className="border p-2 rounded text-sm w-full" required />
                    <textarea placeholder="Highlights & Issues encountered on the field" className="border p-2 rounded text-sm w-full md:col-span-3 h-20"></textarea>
                    <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded text-sm font-medium md:col-span-3">Submit Daily Report to Command Desk</button>
                  </form>
                </div>

                {wo.status === "Assigned" && (
                  <button onClick={() => handleStoreCheckout(wo)} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-xs flex items-center justify-center space-x-1.5"><Package className="w-4 h-4" /><span>Withdraw Materials (Deduct Inventory)</span></button>
                )}
                {wo.status === "Materials Checked Out" && (
                  <button onClick={() => handleFiberHandover(wo.id, wo.ticketId)} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs flex items-center justify-center space-x-1.5"><Check className="w-4 h-4" /><span>Mark Splicing Completed & Handover</span></button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}