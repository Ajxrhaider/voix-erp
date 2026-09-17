import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { FileSignature, Plus, CheckCircle, Clock, XCircle } from 'lucide-react';

export default function Requisitions() {
  const { requisitions, authFetch, refreshSystemData, hasRole } = useContext(AppContext);
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

  const handleReject = async (id) => {
    if (window.confirm("Are you sure you want to officially reject this requisition? The requester will be notified.")) {
      await authFetch(`/api/inventory/requisitions/${id}/reject`, { method: 'PATCH' });
      refreshSystemData();
    }
  };

  const activeReqs = requisitions.filter(r => r.approval_stage !== 'Completed' && r.approval_stage !== 'Rejected');

  const renderProgress = (stage, type) => {
    const stages = type === 'Cash' ? ['Pending Accounting', 'Pending HR', 'Pending GM', 'Completed'] : ['Pending Accounting', 'Pending HR', 'Pending GM', 'Pending Inventory', 'Completed'];
    const currentIndex = stages.indexOf(stage);

    return (
      <div className="flex items-center gap-1 sm:gap-2 mt-4 text-[10px] sm:text-xs font-semibold text-slate-700 w-full overflow-x-auto custom-scrollbar pb-2">
        {stages.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-1 px-2 py-1.5 sm:py-1 rounded whitespace-nowrap shadow-sm sm:shadow-none ${i < currentIndex ? 'text-emerald-800 bg-emerald-50' : i === currentIndex ? 'text-amber-900 bg-amber-50 ring-1 ring-amber-400' : 'text-slate-600 bg-slate-50'}`}>
              {i < currentIndex ? <CheckCircle className="w-3.5 h-3.5 sm:w-3 sm:h-3" /> : <Clock className="w-3.5 h-3.5 sm:w-3 sm:h-3" />}
              {s.replace('Pending ', '')}
            </div>
            {i < stages.length - 1 && <span className="text-slate-400 shrink-0">→</span>}
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
        <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm transition"><Plus className="w-4 h-4"/> New Request</button>
      }
    >
      <div className="grid grid-cols-1 gap-4 w-full">
        {activeReqs.map(req => (
          <div key={req.id} className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3 w-full">
              <div className="w-full min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono font-bold text-slate-700 text-xs sm:text-sm">{req.id}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${req.type === 'Cash' ? 'bg-green-100 text-green-900' : 'bg-blue-100 text-blue-900'}`}>{req.type}</span>
                  {req.work_order_id && <span className="px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">WO: {req.work_order_id}</span>}
                </div>
                <p className="font-bold text-slate-900 text-sm sm:text-base leading-tight mt-1">{req.purpose}</p>
                <p className="text-[11px] sm:text-xs text-slate-700 mt-1">By: <span className="font-bold text-slate-900">{req.requested_by}</span> • {req.department}</p>
                {req.type === 'Cash' && <p className="font-mono font-bold text-emerald-800 mt-2 text-lg sm:text-base">₦{req.amount.toLocaleString()}</p>}
                
                {req.type === 'Materials' && (
                  <div className="mt-2 bg-slate-50 p-2 sm:p-2.5 rounded-lg text-[11px] sm:text-xs font-mono text-slate-800 border border-slate-200 overflow-x-auto custom-scrollbar w-full whitespace-nowrap">
                    {JSON.parse(req.materials_list || '[]').map((m, i) => <span key={i} className="mr-3 inline-block font-bold bg-white px-2 py-1 rounded border border-slate-200 shadow-sm text-slate-900">• {m.qty}x {m.itemName}</span>)}
                  </div>
                )}
              </div>
              
              <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2 mt-3 sm:mt-0 justify-end shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0">
                {((req.approval_stage === 'Pending Accounting' && hasRole(['Accounting', 'Management', 'GM', 'Dev'])) ||
                  (req.approval_stage === 'Pending HR' && hasRole(['HR', 'Management', 'GM', 'Dev'])) ||
                  (req.approval_stage === 'Pending GM' && hasRole(['GM', 'Management', 'Dev'])) ||
                  (req.approval_stage === 'Pending Inventory' && hasRole(['Inventory', 'Management', 'GM', 'Dev']))) && (
                  <>
                    <button onClick={() => handleReject(req.id)} className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-600 hover:text-white px-4 py-2.5 sm:py-2 rounded-lg text-xs font-bold transition shadow-sm w-full sm:w-auto flex items-center justify-center gap-1.5"><XCircle className="w-3.5 h-3.5"/> Reject</button>
                    <button onClick={() => handleApprove(req.id)} className="bg-slate-900 text-white px-4 py-2.5 sm:py-2 rounded-lg text-xs font-bold hover:bg-emerald-600 transition shadow-sm w-full sm:w-auto whitespace-nowrap">
                      {req.approval_stage === 'Pending Inventory' ? 'Issue Materials to WO' : 'Sign & Approve'}
                    </button>
                  </>
                )}
              </div>
            </div>
            {renderProgress(req.approval_stage, req.type)}
          </div>
        ))}
        {activeReqs.length === 0 && <p className="text-slate-600 font-medium p-4 w-full text-center sm:text-left">No pending requisitions in the pipeline.</p>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-lg mb-4 border-b border-slate-200 pb-2 text-slate-900">Submit Requisition</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-700 block mb-1">Requisition Type</label>
                <select onChange={e => setFormData({...formData, type: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 font-bold">
                  <option value="Cash">Cash Requisition</option>
                  <option value="Materials">Materials Requisition</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-700 block mb-1">Purpose / Justification</label>
                <textarea required placeholder="Detailed justification..." onChange={e => setFormData({...formData, purpose: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400 h-20" />
              </div>
              {formData.type === 'Cash' && (
                <div>
                  <label className="text-[10px] sm:text-xs font-bold text-slate-700 block mb-1">Amount Requested</label>
                  <input type="number" required placeholder="Amount (₦)" onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400 font-mono font-bold" />
                </div>
              )}
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 sm:py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg text-sm w-full sm:w-auto transition shadow-sm">Cancel</button>
                <button type="submit" className="px-4 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm shadow-sm w-full sm:w-auto transition">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}