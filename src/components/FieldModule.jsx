// FieldModule.jsx
import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { Wrench, ClipboardList, Package, Send, CheckSquare } from 'lucide-react';

export default function FieldModule() {
  const { workOrders, inventory, authFetch, refreshData } = useContext(AppContext);
  const [reports, setReports] = useState([]);
  
  // Daily shift reports configuration states
  const [summary, setSummary] = useState('');
  const [highlights, setHighlights] = useState('');

  useEffect(() => {
    loadDailyReports();
  }, []);

  const loadDailyReports = async () => {
    try {
      const res = await authFetch('/api/daily-reports');
      if (res.ok) setReports(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleCreateDailyReport = async (e) => {
    e.preventDefault();
    if (!summary) return;
    try {
      await authFetch('/api/daily-reports', {
        method: 'POST',
        body: JSON.stringify({
          id: `REP-${Date.now().toString().slice(-4)}`,
          submittedBy: 'Fiber Squad Alpha', dept: 'Operations',
          date: new Date().toISOString().substring(0, 10), summary, highlights
        })
      });
      setSummary(''); setHighlights('');
      loadDailyReports();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6 text-slate-100 font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Active Issued Field Work Orders View */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-teal-400 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> Live Assigned Dispatch Circuit
          </h3>
          <div className="space-y-3">
            {workOrders.length === 0 ? (
              <p className="text-slate-500 font-mono text-xs">No tasks issued by backend dispatch channels for this loop cycle.</p>
            ) : workOrders.map(wo => (
              <div key={wo.id} className="p-4 bg-slate-950 border border-slate-850 rounded-lg space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">{wo.id}</span>
                  <span className="text-teal-400 font-bold font-mono">{wo.teamId}</span>
                </div>
                <p className="font-medium text-slate-200 text-sm">{wo.objective}</p>
                <div className="bg-slate-900/60 border border-slate-800 rounded p-3">
                  <span className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider block mb-1">Required Materials Vector</span>
                  <p className="text-slate-400 font-mono text-[11px]">GPON ONT Router, 4-Core Drop Cable (200m), Splicing Sleeves.</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* End of Shift Form Submit UI */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-teal-400 mb-4 flex items-center gap-2">
            <Send className="w-4 h-4" /> Submit Shift Report
          </h3>
          <form onSubmit={handleCreateDailyReport} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">Shift Activity Log / Summary</label>
              <textarea rows="3" value={summary} onChange={e => setSummary(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white outline-none" placeholder="Detail tasks completed, splice readings, faults resolved..."></textarea>
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Key Operational Highlights</label>
              <input type="text" value={highlights} onChange={e => setHighlights(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white outline-none" placeholder="e.g. Loops restored under 2 hours SLA" />
            </div>
            <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 font-bold py-2 rounded transition-all">Publish Daily Activity Log</button>
          </form>

          {/* Historic Shift Log Trail */}
          <div className="mt-6 border-t border-slate-800 pt-4">
            <h4 className="text-[11px] font-mono font-bold text-slate-400 mb-3 uppercase tracking-wider">Shift Submission Stream</h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {reports.map(r => (
                <div key={r.id} className="p-2.5 bg-slate-950 border border-slate-850 rounded text-[11px] font-mono">
                  <div className="flex justify-between text-slate-500 text-[10px] mb-1">
                    <span className="text-teal-400/80">{r.submittedBy}</span>
                    <span>{r.date}</span>
                  </div>
                  <p className="text-slate-300 line-clamp-2">{r.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}