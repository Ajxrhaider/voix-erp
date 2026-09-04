import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { FileSignature, Plus, CheckCircle, Clock } from 'lucide-react';

export default function Requisitions() {
  const { requisitions, authFetch, refreshSystemData, hasRole, user } = useContext(AppContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ type: 'Cash', purpose: '', amount: '' });

  const handleCreate = async (e) => {
    e.preventDefault();
    await authFetch('/api/inventory/requisitions', { method: 'POST', body: JSON.stringify(formData) });
    setIsModalOpen(false);
    refreshSystemData();
  };

  const handleApprove = async (id) => {
    await authFetch(`/api/inventory/requisitions/${id}/approve`, { method: 'PATCH' });
    refreshSystemData();
  };

  const activeReqs = requisitions.filter(r => r.approval_stage !== 'Completed' && r.approval_stage !== 'Rejected');

  const renderProgress = (stage, type) => {
    const stages = type === 'Cash' 
      ? ['Pending Accounting', 'Pending HR', 'Pending GM', 'Completed']
      : ['Pending Accounting', 'Pending HR', 'Pending GM', 'Pending Inventory', 'Completed'];
    
    const currentIndex = stages.indexOf(stage);

    return (
      <div className="flex items-center gap-2 mt-4 text-xs font-semibold text-slate-500 w-full overflow-x-auto">
        {stages.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-1 px-2 py-1 rounded ${i < currentIndex ? 'text-emerald-600 bg-emerald-50' : i === currentIndex ? 'text-amber-600 bg-amber-50 ring-1 ring-amber-400' : 'text-slate-400'}`}>
              {i < currentIndex ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {s.replace('Pending ', '')}
            </div>
            {i < stages.length - 1 && <span className="text-slate-300">→</span>}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <ModuleLayout
      title="Requisitions Pipeline"
      subtitle="Multi-level approval workflow"
      icon={<FileSignature className="w-6 h-6" />}
      headerActions={
        <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex gap-2">
          <Plus className="w-4 h-4"/> New Request
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        {activeReqs.map(req => (
          <div key={req.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-slate-500 text-sm">{req.id}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${req.type === 'Cash' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{req.type}</span>
                </div>
                <p className="font-bold text-slate-900">{req.purpose}</p>
                <p className="text-xs text-slate-500 mt-1">By: {req.requested_by} • {req.department}</p>
                {req.type === 'Cash' && <p className="font-mono font-bold text-emerald-700 mt-2">₦{req.amount.toLocaleString()}</p>}
              </div>
              
              <div className="text-right">
                {((req.approval_stage === 'Pending Accounting' && hasRole(['Accounting', 'Management', 'GM', 'Dev'])) ||
                  (req.approval_stage === 'Pending HR' && hasRole(['HR', 'Management', 'GM', 'Dev'])) ||
                  (req.approval_stage === 'Pending GM' && hasRole(['GM', 'Management', 'Dev'])) ||
                  (req.approval_stage === 'Pending Inventory' && hasRole(['Inventory', 'Management', 'GM', 'Dev']))) && (
                  <button onClick={() => handleApprove(req.id)} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-600 transition shadow-sm">
                    {req.approval_stage === 'Pending Inventory' ? 'Issue Materials' : 'Sign & Approve'}
                  </button>
                )}
              </div>
            </div>
            {renderProgress(req.approval_stage, req.type)}
          </div>
        ))}
        {activeReqs.length === 0 && <p className="text-slate-500 p-4">No pending requisitions.</p>}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Submit Requisition</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <select onChange={e => setFormData({...formData, type: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50">
                <option value="Cash">Cash Requisition</option>
                <option value="Materials">Materials Requisition</option>
              </select>
              <input type="text" required placeholder="Purpose / Justification" onChange={e => setFormData({...formData, purpose: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" />
              {formData.type === 'Cash' && (
                <input type="number" required placeholder="Amount (₦)" onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" />
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}