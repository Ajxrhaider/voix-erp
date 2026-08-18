import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { ClipboardList, Package, Save } from 'lucide-react';

export default function FieldReportPortal({ woId }) {
  const { authFetch } = useContext(AppContext);
  const [leftovers, setLeftovers] = useState(''); // Simple text area for now

  const handleSubmitReport = async () => {
    // Parse the report (Mock logic for material reconciliation)
    const reportData = { leftovers: JSON.parse(leftovers || '[]') }; 
    await authFetch(`/api/work-orders/${woId}/complete`, {
      method: 'POST',
      body: JSON.stringify(reportData)
    });
    alert('Field Report Submitted. Materials Reconciled.');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <ClipboardList className="text-teal-400" /> End-of-Day Field Report
      </h3>
      <p className="text-xs text-slate-400">Reconcile material inventory and close the daily work order loop.</p>
      
      <div className="space-y-2">
        <label className="text-[10px] font-mono text-slate-500 uppercase">Leftover Materials (JSON Array)</label>
        <textarea 
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white font-mono text-xs h-32"
          placeholder='[{"id": "INV-001", "qty": 2}]'
          value={leftovers}
          onChange={e => setLeftovers(e.target.value)}
        />
      </div>

      <button onClick={handleSubmitReport} className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition">
        <Save className="w-4 h-4" /> Submit & Close Order
      </button>
    </div>
  );
}