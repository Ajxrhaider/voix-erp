import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { ShoppingCart, FileText, TrendingUp, Award } from 'lucide-react';

export default function GMDeskModule() {
  const { requisitions, dailyReports, employees, authFetch } = useContext(AppContext);

  const handleApproveRequisition = async (id, status) => {
    await authFetch(`/api/requisitions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  };

  const chartData = employees.map(emp => ({
    name: emp.name.split(' ')[0], 
    score: emp.currentScore || 70,
  }));

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-bold text-white">GM Control Room</h2>
        <p className="text-sm text-slate-400">Consolidated operational view of Requisitions, Reports, and Performance.</p>
      </div>

      {/* Live Recharts Graph */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-800 mb-4">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <h3 className="text-base font-bold text-white">Live Staff Performance Matrix</h3>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" tick={{fontSize: 12}} />
              <YAxis stroke="#64748b" tick={{fontSize: 12}} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff' }} />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }}/>
              <Bar dataKey="score" name="Performance Score %" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requisitions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-bold text-white mb-4">Requisition Approvals</h3>
          <div className="space-y-3 max-h-[350px] overflow-y-auto">
            {requisitions.map(r => (
              <div key={r.id} className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                <div className="flex justify-between text-xs">
                  <div>
                    <h4 className="font-bold text-slate-200">{r.item} (Qty: {r.quantity})</h4>
                    <span className="text-teal-400 font-black">Est. Cost: ₦{r.estimatedCost?.toLocaleString()}</span>
                    <p className="text-slate-400 mt-1 italic">"{r.reason}"</p>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-amber-400 bg-amber-500/20">{r.status}</span>
                </div>
                {r.status === "Pending" && (
                  <div className="flex space-x-2 pt-3 mt-3 border-t border-slate-800">
                    <button onClick={() => handleApproveRequisition(r.id, "Approved")} className="flex-1 py-1 bg-emerald-600 text-white text-xs font-bold rounded">Approve</button>
                    <button onClick={() => handleApproveRequisition(r.id, "Rejected")} className="flex-1 py-1 bg-rose-900 text-rose-300 text-xs font-bold rounded">Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Daily Reports */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-bold text-white mb-4">Daily Activity Logs</h3>
          <div className="space-y-3 max-h-[350px] overflow-y-auto">
            {dailyReports.map(rep => (
              <div key={rep.id} className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2 text-xs">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>{rep.date} • By: <strong className="text-teal-400">{rep.submittedBy}</strong></span>
                </div>
                <p className="text-slate-200">{rep.summary}</p>
                <div className="bg-slate-900 p-2 rounded border border-slate-850 text-slate-400 italic">
                  <strong>Highlights:</strong> {rep.highlights}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}