import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { TrendingUp, Plus, MapPin } from 'lucide-react';

export default function Sales() {
  const { sales, authFetch, refreshSystemData, hasRole } = useContext(AppContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    customer_name: '', customer_type: 'FTTH', contact_email: '', contact_phone: '', location: '',
    survey_details: '', proposed_plan: '', amount: '', stage: 'Lead'
  });

  const handleAddDeal = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      const response = await authFetch('/api/sales/pipeline', { method: 'POST', body: JSON.stringify(formData) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'The sales lead could not be saved.');
      setIsModalOpen(false);
      setFormData({ customer_name: '', customer_type: 'FTTH', contact_email: '', contact_phone: '', location: '', survey_details: '', proposed_plan: '', amount: '', stage: 'Lead' });
      await refreshSystemData();
    } catch (error) {
      setErrorMessage(error.message || 'The sales lead could not be saved.');
    }
  };

  const handleStageChange = async (id, newStage) => {
    if (newStage === 'Closing/Won' && !window.confirm('Marking this as Won will immediately auto-create a Provisioning Deployment. Proceed?')) return;
    setErrorMessage('');
    try {
      const response = await authFetch(`/api/sales/pipeline/${encodeURIComponent(id)}/stage`, { method: 'PATCH', body: JSON.stringify({ stage: newStage }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'The deal stage could not be changed.');
      await refreshSystemData();
    } catch (error) {
      setErrorMessage(error.message || 'The deal stage could not be changed.');
    }
  };

  const stages = ['Lead', 'Qualification', 'Proposal', 'Negotiation', 'Closing/Won', 'Lost'];

  return (
    <ModuleLayout
      title="Sales Pipeline"
      subtitle="Track leads, surveys, and closed CRM deals"
      icon={<TrendingUp className="w-6 h-6" />}
      headerActions={hasRole(['Sales', 'Management', 'GM', 'Dev']) && (
        <button onClick={() => { setErrorMessage(''); setIsModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm transition"><Plus className="w-4 h-4"/> Log New Deal</button>
      )}
    >
      {errorMessage && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{errorMessage}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto custom-scrollbar w-full">
        <table className="w-full text-left text-sm min-w-[900px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-3 text-slate-900 font-bold">Deal ID</th>
              <th className="p-3 text-slate-900 font-bold">Customer & Contact</th>
              <th className="p-3 text-slate-900 font-bold">Location</th>
              <th className="p-3 text-slate-900 font-bold">Plan & Value</th>
              <th className="p-3 text-slate-900 font-bold">Current Stage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(sales || []).map(sale => (
              <tr key={sale.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-mono font-bold text-slate-600 whitespace-nowrap">{sale.id}</td>
                <td className="p-3">
                  <p className="font-bold text-slate-900">{sale.customer_name || 'Unknown Client'}</p>
                  <p className="text-[10px] sm:text-xs text-slate-700">{sale.contact_phone} • {sale.contact_email}</p>
                </td>
                <td className="p-3 text-xs text-slate-800 flex items-center gap-1 mt-2 sm:mt-0"><MapPin className="w-3 h-3 text-slate-500"/> {sale.location}</td>
                <td className="p-3">
                  <p className="font-bold text-emerald-700 whitespace-nowrap">₦{Number(sale.amount || 0).toLocaleString()}</p>
                  <p className="text-[10px] sm:text-xs text-slate-700">{sale.customer_type || 'FTTH'} · {sale.proposed_plan}</p>
                </td>
                <td className="p-3">
                  <select 
                    value={sale.stage} 
                    disabled={sale.stage === 'Closing/Won' || sale.stage === 'Lost'}
                    onChange={(e) => handleStageChange(sale.id, e.target.value)} 
                    className="w-full border border-slate-300 p-1.5 sm:p-1 rounded text-xs font-bold bg-white text-slate-900 cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    {stages.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {(!sales || sales.length === 0) && <tr><td colSpan="5" className="p-8 text-center text-slate-600 font-medium">No active deals in the pipeline.</td></tr>}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <h3 className="font-bold text-lg mb-4 border-b border-slate-200 pb-2 text-slate-900">Register Sales Lead</h3>
            {errorMessage && <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{errorMessage}</div>}
            <form onSubmit={handleAddDeal} className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="sm:col-span-2">
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 block mb-1">Customer / Enterprise Name</label>
                <input type="text" required placeholder="Customer Name" onChange={e => setFormData({...formData, customer_name: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400" />
              </div>
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 block mb-1">Customer Type</label>
                <select value={formData.customer_type} onChange={e => setFormData({ ...formData, customer_type: e.target.value })} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 font-bold"><option value="FTTH">FTTH</option><option value="Enterprise">Enterprise</option></select>
              </div>
              
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 block mb-1">Contact Phone</label>
                <input type="text" required placeholder="Phone Number" onChange={e => setFormData({...formData, contact_phone: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400" />
              </div>
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 block mb-1">Contact Email</label>
                <input type="email" placeholder="Email Address" onChange={e => setFormData({...formData, contact_email: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400" />
              </div>
              
              <div className="sm:col-span-2">
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 block mb-1">Exact Location / Address</label>
                <input type="text" required placeholder="Location" onChange={e => setFormData({...formData, location: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400" />
              </div>
              
              <div className="sm:col-span-2">
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 block mb-1">Survey Details</label>
                <textarea placeholder="Optical Survey notes, LOS feasibility..." onChange={e => setFormData({...formData, survey_details: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400 h-20" />
              </div>
              
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 block mb-1">Proposed Plan</label>
                <input type="text" required placeholder="e.g. 100Mbps Dedicated" onChange={e => setFormData({...formData, proposed_plan: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400" />
              </div>
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 block mb-1">Deployment Amount / Initial Payment (₦)</label>
                <input type="number" min="0.01" step="0.01" required placeholder="Initial deployment amount" onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400 font-mono font-bold" />
              </div>

              <div className="sm:col-span-2 flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold px-4 py-2.5 sm:py-2 rounded-lg text-sm w-full sm:w-auto transition shadow-sm">Cancel</button>
                <button type="submit" className="px-4 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm shadow-sm w-full sm:w-auto transition">Add to Pipeline</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}