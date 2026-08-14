import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { FileSignature, Plus } from 'lucide-react';

export default function Requisitions() {
  const { requisitions, authFetch, refreshSystemData, user } = useContext(AppContext);
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

  const activeReqs = requisitions.filter(r => r.approval_stage !== 'Approved' && r.approval_stage !== 'Rejected');

  return (
    <ModuleLayout
      title="Requisitions Approval Pipeline"
      subtitle="Multi-level workflow (Accounting → HR → GM)"
      icon={<FileSignature className="w-6 h-6" />}
      headerActions={
        <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex gap-2">
          <Plus className="w-4 h-4"/> New Request
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        {activeReqs.map(req => (
          <div key={req.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono font-bold text-slate-500 text-sm">{req.id}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${req.type === 'Cash' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{req.type}</span>
              </div>
              <p className="font-bold text-slate-900">{req.purpose}</p>
              <p className="text-xs text-slate-500 mt-1">Requested by: {req.requested_by} • Dept: {req.department}</p>
              {req.type === 'Cash' && <p className="font-mono font-bold text-emerald-700 mt-2">₦{req.amount.toLocaleString()}</p>}
            </div>
            
            <div className="text-right flex flex-col items-end gap-2">
              <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-bold shadow-sm">
                Stage: {req.approval_stage}
              </span>
              
              {/* Approval Logic Gates based on User Role */}
              {((req.approval_stage === 'Pending Accounting' && (user.role === 'Accounting' || user.role === 'Management')) ||
                (req.approval_stage === 'Pending HR' && (user.role === 'HR' || user.role === 'Management')) ||
                (req.approval_stage === 'Pending GM' && (user.role === 'GM' || user.role === 'Management'))) && (
                <button onClick={() => handleApprove(req.id)} className="bg-slate-900 text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-emerald-600 transition">
                  Sign & Approve
                </button>
              )}
            </div>
          </div>
        ))}
        {activeReqs.length === 0 && <p className="text-slate-500 p-4">No pending requisitions require attention.</p>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Submit Requisition</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <select onChange={e => setFormData({...formData, type: e.target.value})} className="w-full border p-2 rounded text-sm bg-white">
                <option value="Cash">Cash Requisition</option>
                <option value="Materials">Materials Requisition</option>
              </select>
              <input type="text" required placeholder="Purpose / Justification" onChange={e => setFormData({...formData, purpose: e.target.value})} className="w-full border p-2 rounded text-sm" />
              {formData.type === 'Cash' && (
                <input type="number" required placeholder="Amount (₦)" onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full border p-2 rounded text-sm" />
              )}
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded font-bold">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}