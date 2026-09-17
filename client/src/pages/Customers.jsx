import React, { useState, useContext, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { Users, Upload, Search, Plus } from 'lucide-react';

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
          <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm transition"><Plus className="w-4 h-4"/> Add Customer</button>
          <input type="file" accept=".xlsx, .csv" ref={fileInputRef} onChange={handleBulkImport} className="hidden" />
          <button onClick={() => fileInputRef.current.click()} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm transition"><Upload className="w-4 h-4"/> Bulk Import</button>
        </div>
      )}
    >
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 flex items-center gap-3 mb-4 sm:mb-6 shadow-sm">
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <input type="text" placeholder="Search by name, MAC, or Voix No..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full text-sm outline-none bg-transparent text-slate-900 placeholder-slate-400" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto w-full shadow-sm">
        <table className="w-full text-left text-sm min-w-[700px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr><th className="p-3 text-slate-800">Voix No.</th><th className="p-3 text-slate-800">Customer Name</th><th className="p-3 text-slate-800">Plan & IP</th><th className="p-3 text-right text-slate-800">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-mono font-bold text-blue-700">{c.voix_no}</td>
                <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{c.name}</td>
                <td className="p-3"><p className="whitespace-nowrap text-slate-800">{c.service_plan}</p><p className="text-xs font-mono text-slate-600">{c.ip_address}</p></td>
                <td className="p-3 text-right"><button onClick={() => setActiveProfile(c)} className="text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg shadow-sm transition">Rich Profile</button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-600 font-medium">No customers found.</td></tr>}
          </tbody>
        </table>
      </div>

      {activeProfile && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-xl sm:text-2xl mb-4 leading-tight text-slate-900">{activeProfile.name} <br className="sm:hidden" /><span className="text-xs sm:text-sm font-mono bg-blue-100 text-blue-900 px-2 py-0.5 rounded sm:ml-2">{activeProfile.voix_no}</span></h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-6">
              <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg text-slate-900"><strong className="text-slate-800">Status:</strong><br/>{activeProfile.status}</div>
              <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg text-slate-900"><strong className="text-slate-800">Schedule:</strong><br/>{activeProfile.payment_schedule}</div>
              <div className="bg-red-50 text-red-900 p-3 border border-red-200 rounded-lg"><strong className="text-red-900">Balance:</strong><br/>₦{activeProfile.outstanding_balance}</div>
              <div className="bg-emerald-50 text-emerald-900 p-3 border border-emerald-200 rounded-lg"><strong className="text-emerald-900">Bank Received:</strong><br/>{activeProfile.bank_received || '-'}</div>
              <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg md:col-span-2 text-slate-900"><strong className="text-slate-800">MAC:</strong><br/><span className="font-mono text-[11px] break-all">{activeProfile.mac_address}</span></div>
              <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg md:col-span-2 text-slate-900"><strong className="text-slate-800">IP:</strong><br/><span className="font-mono text-[11px] break-all">{activeProfile.ip_address}</span></div>
              <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg sm:col-span-2 md:col-span-4 text-slate-900"><strong className="text-slate-800">Address:</strong><br/>{activeProfile.address}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <h4 className="font-bold text-slate-900 border-b border-slate-300 pb-2 mb-3">Support & Interaction Log</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                  {getProfileData(activeProfile.id, activeProfile.name).linkedTickets.map(t => (
                     <div key={t.id} className="text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-900">
                       <span className="font-bold text-blue-800">{t.id} ({t.status}):</span> {t.description}
                       <p className="text-[10px] text-slate-600 mt-1 font-medium">{t.date_received} - {t.query_type}</p>
                     </div>
                  ))}
                  {getProfileData(activeProfile.id, activeProfile.name).linkedTickets.length === 0 && <p className="text-xs text-slate-500 font-medium">No interaction history.</p>}
                </div>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 border-b border-slate-300 pb-2 mb-3">Payment History</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                  {getProfileData(activeProfile.id, activeProfile.name).history.map(l => (
                     <div key={l.id} className="text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center text-slate-900">
                       <div>
                         <p className="font-bold text-slate-900">{l.entry_date}</p>
                         <p className="text-[10px] text-slate-600 font-medium">{l.description}</p>
                       </div>
                       <span className="font-bold font-mono text-emerald-800">₦{l.gross_amount.toLocaleString()}</span>
                     </div>
                  ))}
                  {getProfileData(activeProfile.id, activeProfile.name).history.length === 0 && <p className="text-xs text-slate-500 font-medium">No financial history.</p>}
                </div>
              </div>
            </div>

            <div className="text-right mt-4 pt-4 border-t border-slate-200">
              <button onClick={() => setActiveProfile(null)} className="font-bold bg-slate-200 hover:bg-slate-300 text-slate-900 px-4 py-2.5 rounded-lg w-full sm:w-auto transition shadow-sm">Close Profile</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-lg mb-4 border-b border-slate-200 pb-2 text-slate-900">Manual Customer Boarding</h3>
            <form onSubmit={handleManualAdd} className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <div><label className="text-[10px] text-slate-700 font-bold block mb-1">Voix Number</label><input type="text" placeholder="Auto-gen if blank" onChange={e => setFormData({...formData, voix_no: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              <div className="md:col-span-2"><label className="text-[10px] text-slate-700 font-bold block mb-1">Customer Name</label><input type="text" required placeholder="Customer Name" onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              
              <div><label className="text-[10px] text-slate-700 font-bold block mb-1">MAC Address</label><input type="text" placeholder="MAC Address" onChange={e => setFormData({...formData, mac_address: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              <div><label className="text-[10px] text-slate-700 font-bold block mb-1">Customer Type</label><select onChange={e => setFormData({...formData, customer_type: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 font-bold"><option>FTTH</option><option>Enterprise</option></select></div>
              <div><label className="text-[10px] text-slate-700 font-bold block mb-1">Payment Schedule</label><select onChange={e => setFormData({...formData, payment_schedule: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 font-bold"><option>Monthly</option><option>Quarterly</option><option>Bi-Annual</option><option>Annual</option></select></div>
              
              <div><label className="text-[10px] text-slate-700 font-bold block mb-1">Amount Payable (₦)</label><input type="number" placeholder="Amount Payable (₦)" onChange={e => setFormData({...formData, amount_payable: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400" /></div>
              <div><label className="text-[10px] text-slate-700 font-bold block mb-1">Amount Paid (₦)</label><input type="number" placeholder="Amount Paid (₦)" onChange={e => setFormData({...formData, amount_paid: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400" /></div>
              <div><label className="text-[10px] text-slate-700 font-bold block mb-1">Outstanding Balance (₦)</label><input type="number" placeholder="Outstanding Balance (₦)" onChange={e => setFormData({...formData, outstanding_balance: e.target.value})} className="w-full border border-red-300 p-2.5 rounded-lg text-sm bg-red-50 text-red-900 placeholder-red-400 font-bold" /></div>
              
              <div><label className="text-[10px] text-slate-700 font-bold block mb-1">Bank Received</label><input type="text" placeholder="Bank Received" onChange={e => setFormData({...formData, bank_received: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              <div><label className="text-[10px] text-slate-700 font-bold block mb-1">Last Payment Date</label><input type="date" onChange={e => setFormData({...formData, last_payment_date: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900" /></div>
              <div><label className="text-[10px] text-slate-700 font-bold block mb-1">Next Due Date</label><input type="date" onChange={e => setFormData({...formData, next_due_date: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900" /></div>
              
              <div className="md:col-span-3"><label className="text-[10px] text-slate-700 font-bold block mb-1">Physical Address</label><input type="text" required placeholder="Physical Address" onChange={e => setFormData({...formData, address: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              <div className="md:col-span-2"><label className="text-[10px] text-slate-700 font-bold block mb-1">Email Address</label><input type="email" placeholder="Email Address" onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              <div><label className="text-[10px] text-slate-700 font-bold block mb-1">Phone Number</label><input type="text" placeholder="Phone Number" onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              
              <div className="md:col-span-3 flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 sm:py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg text-sm w-full sm:w-auto transition shadow-sm">Cancel</button>
                <button type="submit" className="px-4 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm w-full sm:w-auto transition">Create Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}