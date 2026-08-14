import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { TrendingUp, Plus } from 'lucide-react';

const STAGES = ['Lead', 'Qualification', 'Proposal', 'Negotiation', 'Closing/Won', 'Lost'];

export default function Sales() {
  const { sales, authFetch, refreshSystemData } = useContext(AppContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ customer_name: '', location: '', amount: '', proposed_plan: '' });

  const totalValue = sales.filter(s => s.stage !== 'Lost').reduce((acc, s) => acc + s.amount, 0);

  const handleCreateSale = async (e) => {
    e.preventDefault();
    await authFetch('/api/sales/pipeline', { method: 'POST', body: JSON.stringify(formData) });
    setIsModalOpen(false);
    refreshSystemData();
  };

  const advanceStage = async (id, currentStage) => {
    const nextIdx = STAGES.indexOf(currentStage) + 1;
    if (nextIdx < STAGES.length) {
      await authFetch(`/api/sales/pipeline/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage: STAGES[nextIdx] }) });
      refreshSystemData();
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <header className="bg-slate-900 text-white p-6 rounded-2xl shadow-md flex justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-amber-600 p-2.5 rounded-lg"><TrendingUp className="w-6 h-6"/></div>
          <div>
            <h1 className="text-xl font-bold">Commercial Sales <span className="text-xs bg-amber-500/30 text-amber-300 px-2 rounded-full">Bitrix24 Engine</span></h1>
            <p className="text-xs text-slate-400">Total Active Pipeline: ₦{totalValue.toLocaleString()}</p>
          </div>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-sm font-bold flex gap-2"><Plus className="w-4 h-4"/> New Survey</button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {STAGES.slice(0, 5).map(stage => (
          <div key={stage} className="bg-slate-100 rounded-xl p-3 min-w-[240px]">
            <h3 className="font-bold text-slate-700 text-sm mb-3 flex justify-between border-b border-slate-200 pb-2">
              {stage} <span className="bg-slate-200 text-slate-600 px-2 rounded-full text-xs">{sales.filter(s => s.stage === stage).length}</span>
            </h3>
            <div className="space-y-2">
              {sales.filter(s => s.stage === stage).map(deal => (
                <div key={deal.id} className="bg-white p-3 rounded shadow-sm border border-slate-200 border-l-4 border-l-amber-500">
                  <p className="font-bold text-slate-900 text-sm truncate">{deal.customer_name}</p>
                  <p className="text-xs text-slate-500 truncate">{deal.location}</p>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                    <p className="font-mono font-bold text-emerald-700 text-xs">₦{deal.amount.toLocaleString()}</p>
                    {stage !== 'Closing/Won' && (
                      <button onClick={() => advanceStage(deal.id, stage)} className="text-[10px] bg-slate-900 text-white px-2 py-1 rounded font-bold hover:bg-emerald-600">Advance →</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Input Sales Survey</h3>
            <form onSubmit={handleCreateSale} className="space-y-3">
              <input type="text" required placeholder="Customer Name" onChange={e => setFormData({...formData, customer_name: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <input type="text" required placeholder="Installation Address" onChange={e => setFormData({...formData, location: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <input type="text" required placeholder="Proposed Plan (e.g. 50Mbps)" onChange={e => setFormData({...formData, proposed_plan: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <input type="number" required placeholder="Deal Amount (₦)" onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded font-bold">Start Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}