// ManagementModule.jsx
import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { Briefcase, ClipboardCheck, ThumbsUp, Star, Award } from 'lucide-react';

export default function ManagementModule() {
  const { authFetch } = useContext(AppContext);
  const [staff, setStaff] = useState([]);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    loadGMCommandMetrics();
  }, []);

  const loadGMCommandMetrics = async () => {
    try {
      const eRes = await authFetch('/api/hr/employees');
      if (eRes.ok) setStaff(await eRes.json());
      const rRes = await authFetch('/api/daily-reports');
      if (rRes.ok) setReports(await rRes.json());
    } catch (err) { console.error(err); }
  };

  const handleAuditReport = async (id) => {
    try {
      const res = await authFetch(`/api/daily-reports/${id}/review`, { method: 'PUT' });
      if (res.ok) loadGMCommandMetrics();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6 text-slate-100 font-sans">
      {/* Visual Appraisal Scoring Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-bold text-teal-400 mb-4 flex items-center gap-2">
          <Award className="w-4 h-4" /> Performance Evaluation Balanced Scorecard
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300 font-mono">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
              <tr>
                <th className="p-3">Staff Node</th>
                <th className="p-3">Department</th>
                <th className="p-3 text-center">HR Weight</th>
                <th className="p-3 text-center">HOD Weight</th>
                <th className="p-3 text-center">GM Final Weight</th>
                <th className="p-3 text-right">Computed score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {staff.map(s => (
                <tr key={s.id} className="hover:bg-slate-950/40">
                  <td className="p-3 font-sans font-bold text-white">{s.name}</td>
                  <td className="p-3 text-slate-400">{s.dept}</td>
                  <td className="p-3 text-center text-slate-300">{s.hrScore || 0}%</td>
                  <td className="p-3 text-center text-slate-300">{s.hodScore || 0}%</td>
                  <td className="p-3 text-center text-teal-400 font-bold">{s.gmScore || 0}%</td>
                  <td className="p-3 text-right">
                    <span className="bg-teal-500/10 border border-teal-500/20 text-teal-400 px-2 py-0.5 rounded font-bold">
                      {s.currentScore || 0}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Field Activity Logs Audit Trail */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-bold text-teal-400 mb-4 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4" /> Shift Activity Audit Log Trail
        </h3>
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="p-4 bg-slate-950 border border-slate-850 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-mono">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{r.id}</span>
                  <span className="text-teal-400 font-bold font-sans">{r.submittedBy} ({r.dept})</span>
                  <span className="text-slate-500 text-[10px]">— {r.date}</span>
                </div>
                <p className="text-slate-300 font-sans text-[13px] pt-1">{r.summary}</p>
                {r.highlights && <p className="text-[11px] text-emerald-400/90"><span className="text-slate-500">Highlight Node:</span> {r.highlights}</p>}
              </div>
              <div className="w-full md:w-auto text-right flex md:flex-col items-center justify-between gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'Reviewed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                  {r.status}
                </span>
                {r.status !== 'Reviewed' && (
                  <button onClick={() => handleAuditReport(r.id)} className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-[11px] px-3 py-1 rounded transition-colors font-sans font-medium">
                    Sign Off Audit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}