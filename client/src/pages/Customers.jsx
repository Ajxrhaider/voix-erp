import React, { useState, useContext, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { Users, Upload, Search, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Customers() {
  const { customers, tickets, ledger, authFetch, refreshSystemData, hasRole } = useContext(AppContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeProfile, setActiveProfile] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    voix_no: '', name: '', mac_address: '', customer_type: 'FTTH', payment_schedule: 'Monthly',
    amount_payable: '', amount_paid: '', bank_received: '', last_payment_date: '', next_due_date: '', outstanding_balance: '', address: '', email: '', phone: ''
  });

  const getProfileData = (custId, custName) => ({
    linkedTickets: tickets.filter(t => t.customer_id === custId || t.customer_name === custName),
    history: ledger.filter(l => l.reference_id === custId || l.customer_name === custName)
  });

  const filtered = customers.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.voix_no?.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleManualAdd = async (e) => {
    e.preventDefault();
    await authFetch('/api/crm/customers', { method: 'POST', body: JSON.stringify(formData) });
    setIsModalOpen(false);
    refreshSystemData();
  };

  const handleBulkImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formDataObj = new FormData();
    formDataObj.append('file', file);
    const res = await authFetch('/api/crm/customers/import', { method: 'POST', body: formDataObj, headers: { 'Content-Type': null } });
    if (res.ok) { alert("Spreadsheet imported successfully!"); refreshSystemData(); }
  };

  return (
    <ModuleLayout
      title="CRM Desk"
      subtitle="Active subscriber profiles & billing"
      icon={<Users className="w-6 h-6" />}
      headerActions={hasRole(['Customer Service', 'Management', 'GM', 'Admin', 'Dev']) && (
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 w-full sm:w-auto"><Plus className="w-4 h-4"/> Add Customer</button>
          <input type="file" accept=".xlsx, .csv" ref={fileInputRef} onChange={handleBulkImport} className="hidden" />
          <button onClick={() => fileInputRef.current.click()} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 w-full sm:w-auto"><Upload className="w-4 h-4"/> Bulk Import</button>
        </div>
      )}
    >
      <div className="bg-white p-3 sm:p-4 rounded-xl border flex items-center gap-3 mb-4 sm:mb-6">
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <input type="text" placeholder="Search by name, MAC, or Voix No..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full text-sm outline-none bg-transparent" />
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto w-full shadow-sm">
        <table className="w-full text-left text-sm min-w-[700px]">
          <thead className="bg-slate-50 border-b"><tr><th className="p-3">Voix No.</th><th className="p-3">Customer Name</th><th className="p-3">Plan & IP</th><th className="p-3 text-right">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="p-3 font-mono font-bold text-blue-700">{c.voix_no}</td>
                <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{c.name}</td>
                <td className="p-3"><p className="whitespace-nowrap">{c.service_plan}</p><p className="text-xs font-mono text-slate-500">{c.ip_address}</p></td>
                <td className="p-3 text-right"><button onClick={() => setActiveProfile(c)} className="text-xs font-bold bg-slate-900 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-slate-800 transition">Rich Profile</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeProfile && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-xl sm:text-2xl mb-4 leading-tight">{activeProfile.name} <br className="sm:hidden" /><span className="text-xs sm:text-sm font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded sm:ml-2">{activeProfile.voix_no}</span></h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-6">
              <div className="bg-slate-50 p-3 border rounded-lg"><strong>Status:</strong><br/>{activeProfile.status}</div>
              <div className="bg-slate-50 p-3 border rounded-lg"><strong>Schedule:</strong><br/>{activeProfile.payment_schedule}</div>
              <div className="bg-red-50 text-red-900 p-3 border border-red-200 rounded-lg"><strong>Balance:</strong><br/>₦{activeProfile.outstanding_balance}</div>
              <div className="bg-emerald-50 text-emerald-900 p-3 border border-emerald-200 rounded-lg"><strong>Bank Received:</strong><br/>{activeProfile.bank_received || '-'}</div>
              <div className="bg-slate-50 p-3 border rounded-lg md:col-span-2"><strong>MAC:</strong><br/><span className="font-mono text-[11px] break-all">{activeProfile.mac_address}</span></div>
              <div className="bg-slate-50 p-3 border rounded-lg md:col-span-2"><strong>IP:</strong><br/><span className="font-mono text-[11px] break-all">{activeProfile.ip_address}</span></div>
              <div className="bg-slate-50 p-3 border rounded-lg sm:col-span-2 md:col-span-4"><strong>Address:</strong><br/>{activeProfile.address}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <h4 className="font-bold text-slate-800 border-b pb-2 mb-3">Support & Interaction Log</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                  {getProfileData(activeProfile.id, activeProfile.name).linkedTickets.map(t => (
                     <div key={t.id} className="text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                       <span className="font-bold text-blue-700">{t.id} ({t.status}):</span> {t.description}
                       <p className="text-[10px] text-slate-500 mt-1">{t.date_received} - {t.query_type}</p>
                     </div>
                  ))}
                  {getProfileData(activeProfile.id, activeProfile.name).linkedTickets.length === 0 && <p className="text-xs text-slate-400">No interaction history.</p>}
                </div>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 border-b pb-2 mb-3">Payment History</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                  {getProfileData(activeProfile.id, activeProfile.name).history.map(l => (
                     <div key={l.id} className="text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                       <div>
                         <p className="font-bold text-slate-800">{l.entry_date}</p>
                         <p className="text-[10px] text-slate-500">{l.description}</p>
                       </div>
                       <span className="font-bold font-mono text-emerald-700">₦{l.gross_amount.toLocaleString()}</span>
                     </div>
                  ))}
                  {getProfileData(activeProfile.id, activeProfile.name).history.length === 0 && <p className="text-xs text-slate-400">No financial history.</p>}
                </div>
              </div>
            </div>

            <div className="text-right mt-4 pt-4 border-t border-slate-200">
              <button onClick={() => setActiveProfile(null)} className="font-bold bg-slate-200 hover:bg-slate-300 text-slate-900 px-4 py-2.5 rounded-lg w-full sm:w-auto transition">Close Profile</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-lg mb-4 border-b pb-2">Manual Customer Boarding</h3>
            <form onSubmit={handleManualAdd} className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <input type="text" placeholder="Voix No. (Auto-gen if blank)" onChange={e => setFormData({...formData, voix_no: e.target.value})} className="border p-2.5 rounded-lg text-sm bg-slate-50" />
              <input type="text" required placeholder="Customer Name" onChange={e => setFormData({...formData, name: e.target.value})} className="border p-2.5 rounded-lg text-sm md:col-span-2 bg-slate-50" />
              <input type="text" placeholder="MAC Address" onChange={e => setFormData({...formData, mac_address: e.target.value})} className="border p-2.5 rounded-lg text-sm bg-slate-50" />
              <select onChange={e => setFormData({...formData, customer_type: e.target.value})} className="border p-2.5 rounded-lg text-sm bg-white font-bold"><option>FTTH</option><option>Enterprise</option></select>
              <select onChange={e => setFormData({...formData, payment_schedule: e.target.value})} className="border p-2.5 rounded-lg text-sm bg-white font-bold"><option>Monthly</option><option>Quarterly</option><option>Bi-Annual</option><option>Annual</option></select>
              <input type="number" placeholder="Amount Payable (₦)" onChange={e => setFormData({...formData, amount_payable: e.target.value})} className="border p-2.5 rounded-lg text-sm bg-white" />
              <input type="number" placeholder="Amount Paid (₦)" onChange={e => setFormData({...formData, amount_paid: e.target.value})} className="border p-2.5 rounded-lg text-sm bg-white" />
              <input type="number" placeholder="Outstanding Balance (₦)" onChange={e => setFormData({...formData, outstanding_balance: e.target.value})} className="border p-2.5 rounded-lg text-sm bg-red-50 text-red-900" />
              <input type="text" placeholder="Bank Received" onChange={e => setFormData({...formData, bank_received: e.target.value})} className="border p-2.5 rounded-lg text-sm bg-slate-50" />
              <div><label className="text-[10px] text-slate-500 font-bold block mb-1">Last Payment Date</label><input type="date" onChange={e => setFormData({...formData, last_payment_date: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white" /></div>
              <div><label className="text-[10px] text-slate-500 font-bold block mb-1">Next Due Date</label><input type="date" onChange={e => setFormData({...formData, next_due_date: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white" /></div>
              <input type="text" required placeholder="Physical Address" onChange={e => setFormData({...formData, address: e.target.value})} className="border p-2.5 rounded-lg text-sm md:col-span-3 bg-slate-50" />
              <input type="email" placeholder="Email Address" onChange={e => setFormData({...formData, email: e.target.value})} className="border p-2.5 rounded-lg text-sm md:col-span-2 bg-slate-50" />
              <input type="text" placeholder="Phone Number" onChange={e => setFormData({...formData, phone: e.target.value})} className="border p-2.5 rounded-lg text-sm bg-slate-50" />
              <div className="md:col-span-3 flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 sm:py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg text-sm font-bold w-full sm:w-auto transition">Cancel</button>
                <button type="submit" className="px-4 py-2.5 sm:py-2 bg-emerald-600 text-white font-bold rounded-lg shadow-sm">Create Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}