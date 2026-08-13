import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { Calendar, Play, ShoppingCart, ClipboardList, User } from 'lucide-react';

export default function CTOModule() {
  const { authFetch } = useContext(AppContext);
  const [tickets, setTickets] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [dailyPlans, setDailyPlans] = useState([]);

  // Form State
  const [planObjective, setPlanObjective] = useState("");
  const [planTickets, setPlanTickets] = useState([]);
  const [planTeam, setPlanTeam] = useState("TEAM-A");
  const [planWOObjective, setPlanWOObjective] = useState("");

  const fiberTeams = [
    { id: "TEAM-A", name: "Fiber Squad Alpha", members: ["Obi Nwosu", "Chidi Okafor"] },
    { id: "TEAM-B", name: "Fiber Squad Beta", members: ["Segun Oni", "Emeka Uzo"] }
  ];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [tRes, wRes, pRes] = await Promise.all([
        authFetch('/api/installation-tickets'),
        authFetch('/api/work-orders'),
        authFetch('/api/daily-work-plans')
      ]);
      if (tRes.ok) setTickets(await tRes.json());
      if (wRes.ok) setWorkOrders(await wRes.json());
      if (pRes.ok) setDailyPlans(await pRes.json());
    } catch (err) { console.error(err); }
  };

  const handleCreateDailyPlan = async (e) => {
    e.preventDefault();
    if (!planObjective) return;

    try {
      // 1. Create the Work Plan
      await authFetch('/api/daily-work-plans', {
        method: 'POST',
        body: JSON.stringify({
          date: new Date().toISOString().substring(0, 10),
          objective: planObjective,
          selectedTickets: planTickets,
          status: "Published"
        })
      });

      // 2. Create the Dispatch Work Order with standard baseline materials
      await authFetch('/api/work-orders', {
        method: 'POST',
        body: JSON.stringify({
          id: `WO-${Date.now().toString().slice(-4)}`,
          teamId: planTeam,
          ticketId: planTickets[0] || "General-Maintenance",
          objective: planWOObjective || planObjective,
          materialsRequired: [
            { item: "GPON ONT Router (Wi-Fi 6)", qty: 1 },
            { item: "Fiber Drop Cable (4-Core, 1km Drum)", qty: 0.2 },
            { item: "Optical Splicing Sleeves (Pack of 100)", qty: 1 }
          ],
          status: "Assigned"
        })
      });

      setPlanObjective(""); setPlanWOObjective(""); setPlanTickets([]);
      loadData();
      alert("Daily Plan Published & Dispatch Sent to Field Squad!");
    } catch (err) { console.error(err); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-slate-100 font-sans">
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center space-x-2 mb-4">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Formulate Daily Work Plan</h2>
          </div>
          <form onSubmit={handleCreateDailyPlan} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Today's Tactical Objective</label>
              <textarea required value={planObjective} onChange={(e) => setPlanObjective(e.target.value)} rows="2" className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Target Installation Tickets from Sales</label>
              <div className="space-y-2 max-h-32 overflow-y-auto bg-slate-950 p-2 rounded border border-slate-800">
                {tickets.length === 0 ? <p className="text-xs text-slate-500 p-2">No pending installation tickets.</p> : tickets.map(ticket => (
                  <label key={ticket.id} className="flex items-center space-x-2 text-xs p-1 cursor-pointer">
                    <input type="checkbox" checked={planTickets.includes(ticket.id)} onChange={(e) => setPlanTickets(e.target.checked ? [...planTickets, ticket.id] : planTickets.filter(id => id !== ticket.id))} className="rounded border-slate-800" />
                    <span className="font-mono text-indigo-400">{ticket.id}</span>
                    <span className="text-slate-300">({ticket.customer})</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="border-t border-slate-800 pt-4 space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Assign to 3-Man Fiber Squad</label>
                <select value={planTeam} onChange={(e) => setPlanTeam(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white font-mono">
                  {fiberTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Squad Specific Objective</label>
                <input type="text" required value={planWOObjective} onChange={(e) => setPlanWOObjective(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white" />
              </div>
            </div>
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded text-xs flex items-center justify-center space-x-1">
              <span>Publish Work Plan & Issue Order</span><Play className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-7 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-4">
            <ClipboardList className="w-4 h-4 text-teal-400" /> Issued Work Orders
          </h3>
          <div className="space-y-3">
            {workOrders.map((wo) => (
              <div key={wo.id} className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-400">#{wo.id}</span>
                    <h4 className="text-sm font-bold text-white mt-1">{wo.objective}</h4>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono ${wo.status === 'Assigned' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {wo.status}
                  </span>
                </div>
                <div className="bg-slate-900 p-2 rounded text-[11px] font-mono text-slate-400">
                  <span className="text-amber-500 font-bold">Materials Bundled: </span> 
                  {wo.materialsRequired.map(m => `${m.qty}x ${m.item}`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}