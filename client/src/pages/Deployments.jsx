import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { Server, Plus } from 'lucide-react';

export default function Deployments() {
  const { deployments, authFetch, refreshSystemData, hasRole } = useContext(AppContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '', date_of_payment: '', amount: '', phone: '', priority: 'Medium',
    location: '', customer_type: 'FTTH', plan: 'Standard 50Mbps', start_date: '', end_date: '', sales_made_by: '', notes: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await authFetch('/api/deployments', { method: 'POST', body: JSON.stringify(formData) });
    setIsModalOpen(false);
    refreshSystemData();
  };

  return (
    <ModuleLayout
      title="Provisioning & Deployments"
      subtitle="Track field installations and network provisioning"
      icon={<Server className="w-6 h-6" />}
      headerActions={
        hasRole(['Sales', 'Management', 'GM', 'Dev', 'NOC']) && (
          <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 md:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 w-full md:w-auto"><Plus className="w-4 h-4"/> Manual Deployment</button>
        )
      }
    >
      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto w-full">
        <table className="w-full text-left text-sm min-w-[800px]">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-3 whitespace-nowrap">Customer Name</th>
              <th className="p-3">Exact Address</th>
              <th className="p-3 text-center whitespace-nowrap">Service Type</th>
              <th className="p-3 text-center">Priority</th>
              <th className="p-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deployments.map(d => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{d.customer_name}</td>
                <td className="p-3 text-xs text-slate-600 min-w-[200px]">{d.location}</td>
                <td className="p-3 text-center font-bold text-xs"><span className={`px-2 py-0.5 rounded ${d.customer_type === 'Enterprise' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100'}`}>{d.customer_type}</span></td>
                <td className="p-3 text-center font-bold text-xs text-amber-600">{d.priority || 'Medium'}</td>
                <td className="p-3 text-center font-bold text-xs"><span className={`px-2 py-1 rounded ${d.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-slate-100'}`}>{d.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-lg mb-4 border-b pb-2">Initialize Provisioning Deployment</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <input type="text" required placeholder="Customer Name" onChange={e => setFormData({...formData, customer_name: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm md:col-span-2 bg-slate-50" />
              <input type="text" required placeholder="Exact Address / Location" onChange={e => setFormData({...formData, location: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm md:col-span-2 bg-slate-50" />
              
              <div><label className="text-[10px] font-bold text-slate-500 block mb-1">Date of Payment</label><input type="date" required onChange={e => setFormData({...formData, date_of_payment: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white" /></div>
              <div><label className="text-[10px] font-bold text-slate-500 block mb-1">Amount Paid</label><input type="number" required placeholder="Amount (₦)" onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white" /></div>
              
              <input type="text" required placeholder="Phone Number" onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" />
              <select onChange={e => setFormData({...formData, priority: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50 font-bold"><option>Medium</option><option>High</option><option>Low</option></select>
              
              <select onChange={e => setFormData({...formData, customer_type: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50 font-bold"><option>FTTH</option><option>Enterprise</option></select>
              <input type="text" required placeholder="Service Plan" onChange={e => setFormData({...formData, plan: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" />
              
              <div><label className="text-[10px] font-bold text-slate-500 block mb-1">Start Date</label><input type="date" onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white" /></div>
              <div><label className="text-[10px] font-bold text-slate-500 block mb-1">End Date</label><input type="date" onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white" /></div>
              
              <input type="text" required placeholder="Sales made by (Staff Name)" onChange={e => setFormData({...formData, sales_made_by: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" />
              <input type="text" placeholder="Notes / Observations" onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" />
              
              <div className="md:col-span-2 flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 sm:py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg text-sm font-bold w-full sm:w-auto transition">Cancel</button>
                <button type="submit" className="px-4 py-2.5 sm:py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold text-center w-full sm:w-auto">Initialize Deployment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}