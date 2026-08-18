import React, { useState, useContext, useMemo, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { Users, Upload, CreditCard, Search, Link as LinkIcon } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Customers() {
  const { customers, tickets, deployments, ledger, authFetch, refreshSystemData, hasRole } = useContext(AppContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeProfile, setActiveProfile] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const fileInputRef = useRef(null);

  const kpis = useMemo(() => [
    { title: "Total Clients", value: customers.length, colorClass: "text-slate-900" },
    { title: "FTTH Residential", value: customers.filter(c => c.customer_type === 'FTTH').length, colorClass: "text-blue-600" },
    { title: "Enterprise Rings", value: customers.filter(c => c.customer_type === 'Enterprise').length, colorClass: "text-purple-600" },
  ], [customers]);

  const filtered = customers.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.voix_no?.toLowerCase().includes(searchQuery.toLowerCase()));

  // SheetJS Excel Array Extraction Engine
  const handleBulkImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);
      
      const res = await authFetch('/api/crm/customers/bulk-import', { method: 'POST', body: JSON.stringify({ rows: data }) });
      if (res.ok) {
        alert("Spreadsheet imported successfully!");
        refreshSystemData();
      }
    };
    reader.readAsBinaryString(file);
  };

  const processPayment = async (e) => {
    e.preventDefault();
    const payload = {
      amount: parseFloat(paymentAmount),
      description: `Subscription Renewal for ${activeProfile.name}`,
      durationMonths: 1
    };

    const res = await authFetch(`/api/crm/customers/${activeProfile.id}/pay`, { method: 'POST', body: JSON.stringify(payload) });
    if (res.ok) {
      alert("Payment processed. Auto-synced to Accounting Income Ledger.");
      setPaymentAmount('');
      refreshSystemData();
    }
  };

  const getProfileData = (custId, custName) => {
    return {
      linkedTickets: tickets.filter(t => t.customer_id === custId || t.customer_name === custName),
      linkedDeps: deployments.filter(d => d.customer_name === custName),
      history: ledger.filter(l => l.reference_id === custId || l.customer_name === custName)
    };
  };

  return (
    <ModuleLayout
      title="CRM Desk"
      subtitle="Active subscriber profiles & billing management"
      icon={<Users className="w-6 h-6" />}
      kpis={kpis}
      headerActions={
        hasRole(['Customer Service', 'Management', 'GM', 'Admin', 'Dev']) && (
          <>
            <input type="file" accept=".xlsx, .csv" ref={fileInputRef} onChange={handleBulkImport} className="hidden" />
            <button onClick={() => fileInputRef.current.click()} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
              <Upload className="w-4 h-4"/> Bulk Import
            </button>
          </>
        )
      }
    >
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex gap-3 mb-6">
        <Search className="w-5 h-5 text-slate-400 mt-2" />
        <input type="text" placeholder="Search by name, MAC, or Voix Number..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full text-sm outline-none" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-3">Voix No.</th>
              <th className="p-3">Customer Name</th>
              <th className="p-3">Plan & IP</th>
              <th className="p-3 text-center">Type</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="p-3 font-mono font-bold text-blue-700">{c.voix_no}</td>
                <td className="p-3 font-bold text-slate-900">{c.name}</td>
                <td className="p-3"><p>{c.service_plan}</p><p className="text-xs font-mono text-slate-500">{c.ip_address}</p></td>
                <td className="p-3 text-center"><span className={`px-2 py-0.5 text-[10px] font-bold rounded ${c.customer_type === 'Enterprise' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-800'}`}>{c.customer_type}</span></td>
                <td className="p-3 text-right">
                  <button onClick={() => setActiveProfile(c)} className="text-xs font-bold bg-slate-900 text-white px-3 py-1.5 rounded hover:bg-slate-800">Rich Profile</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeProfile && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-bold text-2xl text-slate-900">{activeProfile.name}</h3>
                <p className="font-mono text-sm text-blue-600 font-bold">{activeProfile.voix_no} • {activeProfile.status}</p>
              </div>
              <button onClick={() => setActiveProfile(null)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-6">
              <div className="bg-slate-50 p-3 rounded border border-slate-200"><strong>MAC:</strong> <br/><span className="font-mono text-xs">{activeProfile.mac_address}</span></div>
              <div className="bg-slate-50 p-3 rounded border border-slate-200"><strong>IP:</strong> <br/><span className="font-mono text-xs">{activeProfile.ip_address}</span></div>
              <div className="bg-slate-50 p-3 rounded border border-slate-200 col-span-2"><strong>Address:</strong> <br/><span className="text-xs">{activeProfile.address}</span></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Linked Deployments & Tickets */}
              <div>
                <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-3"><LinkIcon className="w-4 h-4"/> Associated History</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {getProfileData(activeProfile.id, activeProfile.name).linkedDeps.map(d => (
                     <div key={d.id} className="text-xs bg-indigo-50 text-indigo-900 p-2 rounded border border-indigo-100">
                       <span className="font-bold">Deployment:</span> {d.status} ({d.created_at.substring(0,10)})
                     </div>
                  ))}
                  {getProfileData(activeProfile.id, activeProfile.name).linkedTickets.map(t => (
                     <div key={t.id} className="text-xs bg-amber-50 text-amber-900 p-2 rounded border border-amber-100">
                       <span className="font-bold">{t.id}:</span> {t.category} - {t.status}
                     </div>
                  ))}
                </div>
              </div>

              {/* Payment Processing & Ledger */}
              <div>
                <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-3"><CreditCard className="w-4 h-4"/> Financial Ledger</h4>
                <form onSubmit={processPayment} className="flex gap-2 mb-4">
                  <input type="number" required placeholder="Amount (₦)" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full border p-2 rounded text-sm font-mono" />
                  <button type="submit" className="bg-emerald-600 text-white font-bold px-4 py-2 rounded text-sm whitespace-nowrap hover:bg-emerald-500">Record Payment</button>
                </form>
                
                <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                  {getProfileData(activeProfile.id, activeProfile.name).history.map(l => (
                     <div key={l.id} className="text-xs bg-slate-50 p-2 rounded border flex justify-between">
                       <span>{l.entry_date}</span>
                       <span className="font-bold font-mono text-emerald-700">₦{l.gross_amount.toLocaleString()}</span>
                     </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}