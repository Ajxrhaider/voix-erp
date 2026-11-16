import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { CheckCircle2, Plus, Server } from 'lucide-react';

const blankDeployment = () => ({
  customer_name: '', email: '', date_of_payment: '', amount: '', payment_mode: 'Bank Transfer', phone: '', priority: 'P1',
  location: '', customer_type: 'FTTH', plan: 'Standard 50Mbps', start_date: '', end_date: '', sales_made_by: '', notes: ''
});

const blankResolution = () => ({ fat_box: '', splitter_port: '', onu_mac: '', assigned_ip: '' });
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 placeholder:text-slate-400';

export default function Deployments() {
  const { deployments, authFetch, refreshSystemData, hasRole } = useContext(AppContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resolvingDeployment, setResolvingDeployment] = useState(null);
  const [formData, setFormData] = useState(blankDeployment);
  const [resolutionData, setResolutionData] = useState(blankResolution);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const canResolve = hasRole(['HOD NOC', 'NOC', 'HOD Fiber', 'Fiber', 'Management', 'GM', 'Dev']);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSaving(true);
    try {
      const response = await authFetch('/api/deployments', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Deployment could not be created.');
      setIsModalOpen(false);
      setFormData(blankDeployment());
      setSuccessMessage('Deployment added to the provisioning queue.');
      await refreshSystemData();
    } catch (error) {
      setErrorMessage(error.message || 'Deployment could not be created.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResolve = async (event) => {
    event.preventDefault();
    if (!resolvingDeployment) return;
    setErrorMessage('');
    setSuccessMessage('');
    setIsSaving(true);
    try {
      const response = await authFetch(`/api/deployments/${encodeURIComponent(resolvingDeployment.id)}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify(resolutionData)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Deployment could not be completed.');
      setResolvingDeployment(null);
      setResolutionData(blankResolution());
      setSuccessMessage(body.message || 'Deployment completed and customer profile updated.');
      await refreshSystemData();
    } catch (error) {
      setErrorMessage(error.message || 'Deployment could not be completed.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModuleLayout
      title="Provisioning & Deployments"
      subtitle="Track field installations, capture the initial payment, and activate customer profiles"
      icon={<Server className="w-6 h-6" />}
      headerActions={hasRole(['Sales', 'Management', 'GM', 'Dev', 'NOC']) && (
        <button onClick={() => { setErrorMessage(''); setIsModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 md:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 w-full md:w-auto shadow-sm transition">
          <Plus className="w-4 h-4" /> Manual Deployment
        </button>
      )}
    >
      {(errorMessage || successMessage) && (
        <div role={errorMessage ? 'alert' : 'status'} className={`mb-4 rounded-lg border px-4 py-3 text-sm font-semibold ${errorMessage ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {errorMessage || successMessage}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto custom-scrollbar w-full">
        <table className="w-full text-left text-sm min-w-[1050px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-3 whitespace-nowrap text-slate-900 font-bold">Customer Name</th>
              <th className="p-3 text-slate-900 font-bold">Exact Address</th>
              <th className="p-3 text-center whitespace-nowrap text-slate-900 font-bold">Service Type</th>
              <th className="p-3 text-right whitespace-nowrap text-slate-900 font-bold">Initial Payment</th>
              <th className="p-3 text-center text-slate-900 font-bold">Priority</th>
              <th className="p-3 text-center text-slate-900 font-bold">Status</th>
              <th className="p-3 text-right text-slate-900 font-bold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(deployments || []).map((deployment) => (
              <tr key={deployment.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                  {deployment.customer_name}
                  <span className="block mt-0.5 text-[10px] font-mono font-medium text-slate-500">{deployment.external_ref || deployment.id}</span>
                </td>
                <td className="p-3 text-xs text-slate-700 min-w-[200px]">{deployment.location}</td>
                <td className="p-3 text-center font-bold text-xs">
                  <span className={`px-2 py-0.5 rounded ${deployment.customer_type === 'Enterprise' ? 'bg-purple-100 text-purple-900' : 'bg-slate-200 text-slate-800'}`}>{deployment.customer_type || 'FTTH'}</span>
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <p className="font-mono font-bold text-slate-900">₦{Number(deployment.amount || 0).toLocaleString('en-NG')}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{deployment.date_of_payment || 'Date not recorded'} · {deployment.payment_mode || 'Bank Transfer'}</p>
                </td>
                <td className="p-3 text-center font-bold text-[11px] whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded ${deployment.priority?.includes('P0') || deployment.priority === 'High' ? 'bg-red-100 text-red-900' : deployment.priority?.includes('P10') || deployment.priority === 'Low' ? 'bg-slate-200 text-slate-800' : 'bg-amber-100 text-amber-900'}`}>
                    {deployment.priority || 'P1'}
                  </span>
                </td>
                <td className="p-3 text-center font-bold text-xs"><span className={`px-2 py-1 rounded ${deployment.status === 'Completed' ? 'bg-green-100 text-green-900' : 'bg-slate-100 text-slate-800'}`}>{deployment.status}</span></td>
                <td className="p-3 text-right">
                  {canResolve && deployment.status !== 'Completed' && (
                    <button
                      onClick={() => { setErrorMessage(''); setResolutionData(blankResolution()); setResolvingDeployment(deployment); }}
                      className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Complete & activate
                    </button>
                  )}
                  {deployment.status === 'Completed' && <span className="text-xs font-semibold text-emerald-700">Profile active</span>}
                </td>
              </tr>
            ))}
            {(!deployments || deployments.length === 0) && <tr><td colSpan="7" className="p-8 text-center text-slate-600 font-medium">No deployments found.</td></tr>}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <h3 className="font-bold text-lg mb-4 border-b border-slate-200 pb-2 text-slate-900">Initialize Provisioning Deployment</h3>
            {errorMessage && <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{errorMessage}</div>}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <label className="md:col-span-2 text-[10px] font-bold text-slate-900">Customer Name<input type="text" required value={formData.customer_name} onChange={(event) => setFormData({ ...formData, customer_name: event.target.value })} placeholder="Customer Name" className={`${inputClass} mt-1`} /></label>
              <label className="md:col-span-2 text-[10px] font-bold text-slate-900">Email Address (optional)<input type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} placeholder="Email Address" className={`${inputClass} mt-1`} /></label>
              <label className="md:col-span-2 text-[10px] font-bold text-slate-900">Exact Address / Location<input type="text" required value={formData.location} onChange={(event) => setFormData({ ...formData, location: event.target.value })} placeholder="Exact Address / Location" className={`${inputClass} mt-1`} /></label>
              <label className="text-[10px] font-bold text-slate-900">Date of Payment<input type="date" required value={formData.date_of_payment} onChange={(event) => setFormData({ ...formData, date_of_payment: event.target.value })} className={`${inputClass} mt-1`} /></label>
              <label className="text-[10px] font-bold text-slate-900">Amount Paid (₦)<input type="number" min="0.01" step="0.01" required value={formData.amount} onChange={(event) => setFormData({ ...formData, amount: event.target.value })} placeholder="Amount (₦)" className={`${inputClass} mt-1 font-mono font-bold`} /></label>
              <label className="text-[10px] font-bold text-slate-900">Payment Method<select value={formData.payment_mode} onChange={(event) => setFormData({ ...formData, payment_mode: event.target.value })} className={`${inputClass} mt-1 font-bold`}>
                {['Bank Transfer', 'Cash', 'POS', 'Card', 'Cheque', 'USSD', 'Other'].map((method) => <option key={method}>{method}</option>)}
              </select></label>
              <label className="text-[10px] font-bold text-slate-900">Phone Number<input type="text" required value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} placeholder="Phone Number" className={`${inputClass} mt-1`} /></label>
              <label className="text-[10px] font-bold text-slate-900">Priority Level<select value={formData.priority} onChange={(event) => setFormData({ ...formData, priority: event.target.value })} className={`${inputClass} mt-1 font-bold`}>
                <option value="P0 (Critical)">P0 (Critical)</option><option value="P1">P1</option><option value="P2">P2</option><option value="P10 (Low)">P10 (Low)</option><option value="High">High (Legacy Fallback)</option><option value="Medium">Medium (Legacy Fallback)</option><option value="Low">Low (Legacy Fallback)</option>
              </select></label>
              <label className="text-[10px] font-bold text-slate-900">Customer Type<select value={formData.customer_type} onChange={(event) => setFormData({ ...formData, customer_type: event.target.value })} className={`${inputClass} mt-1 font-bold`}><option>FTTH</option><option>Enterprise</option></select></label>
              <label className="text-[10px] font-bold text-slate-900">Service Plan<input type="text" required value={formData.plan} onChange={(event) => setFormData({ ...formData, plan: event.target.value })} placeholder="Service Plan" className={`${inputClass} mt-1`} /></label>
              <label className="text-[10px] font-bold text-slate-900">Start Date<input type="date" value={formData.start_date} onChange={(event) => setFormData({ ...formData, start_date: event.target.value })} className={`${inputClass} mt-1`} /></label>
              <label className="text-[10px] font-bold text-slate-900">End Date<input type="date" value={formData.end_date} onChange={(event) => setFormData({ ...formData, end_date: event.target.value })} className={`${inputClass} mt-1`} /></label>
              <label className="text-[10px] font-bold text-slate-900">Sales made by<input type="text" required value={formData.sales_made_by} onChange={(event) => setFormData({ ...formData, sales_made_by: event.target.value })} placeholder="Staff name" className={`${inputClass} mt-1`} /></label>
              <label className="text-[10px] font-bold text-slate-900">Notes / Observations<input type="text" value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} placeholder="Optional notes" className={`${inputClass} mt-1`} /></label>
              <div className="md:col-span-2 flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold px-4 py-2.5 rounded-lg text-sm w-full sm:w-auto">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-lg text-sm shadow-sm w-full sm:w-auto">{isSaving ? 'Saving…' : 'Initialize Deployment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resolvingDeployment && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <h3 className="font-bold text-lg text-slate-900">Complete deployment</h3>
            {errorMessage && <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{errorMessage}</div>}
            <p className="mt-1 mb-4 text-sm text-slate-600">{resolvingDeployment.customer_name} · {resolvingDeployment.id}. Completing this deployment activates the customer profile and records the initial payment in its history and the accounting ledger.</p>
            <form onSubmit={handleResolve} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-[10px] font-bold text-slate-900">FAT Box<input value={resolutionData.fat_box} onChange={(event) => setResolutionData({ ...resolutionData, fat_box: event.target.value })} placeholder="FAT-01" className={`${inputClass} mt-1`} /></label>
              <label className="text-[10px] font-bold text-slate-900">Splitter Port<input value={resolutionData.splitter_port} onChange={(event) => setResolutionData({ ...resolutionData, splitter_port: event.target.value })} placeholder="Port 4" className={`${inputClass} mt-1`} /></label>
              <label className="text-[10px] font-bold text-slate-900">ONU MAC Address<input value={resolutionData.onu_mac} onChange={(event) => setResolutionData({ ...resolutionData, onu_mac: event.target.value })} placeholder="ONU MAC" className={`${inputClass} mt-1`} /></label>
              <label className="text-[10px] font-bold text-slate-900">Assigned IP Address<input value={resolutionData.assigned_ip} onChange={(event) => setResolutionData({ ...resolutionData, assigned_ip: event.target.value })} placeholder="IP address" className={`${inputClass} mt-1`} /></label>
              <div className="sm:col-span-2 flex flex-col sm:flex-row justify-end gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setResolvingDeployment(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold px-4 py-2.5 rounded-lg text-sm w-full sm:w-auto">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-lg text-sm shadow-sm w-full sm:w-auto">{isSaving ? 'Completing…' : 'Complete & activate profile'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}
