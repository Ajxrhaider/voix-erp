import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { Network, CheckCircle } from 'lucide-react';

export default function Deployments() {
  const { deployments, authFetch, refreshSystemData } = useContext(AppContext);
  const [resolveDep, setResolveDep] = useState(null);
  const [mac, setMac] = useState('');

  const activeDeps = deployments.filter(d => d.status !== 'Completed');

  const completeDeployment = async (e) => {
    e.preventDefault();
    await authFetch(`/api/deployments/${resolveDep.id}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ onu_mac: mac })
    });
    setResolveDep(null);
    refreshSystemData();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <header className="bg-slate-900 text-white p-6 rounded-2xl shadow-md flex items-center gap-3">
        <div className="bg-indigo-600 p-2.5 rounded-lg"><Network className="w-6 h-6"/></div>
        <div>
          <h1 className="text-xl font-bold">Provisioning & Deployments</h1>
          <p className="text-xs text-slate-400">Fiber installations triggered automatically by closed sales</p>
        </div>
      </header>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-3">Deployment ID</th>
              <th className="p-3">Client & Location</th>
              <th className="p-3">Service Plan</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeDeps.map(dep => (
              <tr key={dep.id} className="hover:bg-slate-50">
                <td className="p-3 font-mono font-bold text-indigo-700">{dep.id}</td>
                <td className="p-3"><p className="font-bold text-slate-900">{dep.customer_name}</p><p className="text-xs text-slate-500">{dep.location}</p></td>
                <td className="p-3 font-mono text-xs">{dep.plan}</td>
                <td className="p-3 text-center"><span className="px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs font-bold">{dep.status}</span></td>
                <td className="p-3 text-right">
                  <button onClick={() => setResolveDep(dep)} className="bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-emerald-500 flex items-center gap-1 inline-flex">
                    <CheckCircle className="w-3 h-3"/> Complete
                  </button>
                </td>
              </tr>
            ))}
            {activeDeps.length === 0 && <tr><td colSpan="5" className="p-6 text-center text-slate-400">No pending installations.</td></tr>}
          </tbody>
        </table>
      </div>

      {resolveDep && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-lg mb-2">Finalize Deployment</h3>
            <p className="text-xs text-slate-500 mb-4">This will auto-generate a Customer Profile for <strong>{resolveDep.customer_name}</strong>.</p>
            <form onSubmit={completeDeployment} className="space-y-3">
              <input type="text" required placeholder="Device MAC Address" value={mac} onChange={e => setMac(e.target.value)} className="w-full border p-2 rounded text-sm font-mono" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setResolveDep(null)} className="px-4 py-2 border rounded text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-bold">Generate Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}