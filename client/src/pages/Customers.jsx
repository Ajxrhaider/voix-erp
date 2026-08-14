import React, { useState, useContext, useMemo, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { Users, Upload, CreditCard, Search } from 'lucide-react';

export default function Customers() {
  const { customers, authFetch, refreshSystemData } = useContext(AppContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeProfile, setActiveProfile] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const fileInputRef = useRef(null);

  const kpis = useMemo(() => [
    { title: "Total Clients", value: customers.length, color: "text-slate-900" },
    { title: "FTTH Residential", value: customers.filter(c => c.customer_type === 'FTTH').length, color: "text-blue-600" },
    { title: "Enterprise Rings", value: customers.filter(c => c.customer_type === 'Enterprise').length, color: "text-purple-600" },
  ], [customers]);

  const filtered = customers.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.voix_no?.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleBulkImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    const res = await authFetch('/api/crm/customers/import', { method: 'POST', body: formData, headers: { 'Content-Type': null } });
    if (res.ok) {
      alert("Spreadsheet imported successfully!");
      refreshSystemData();
    }
  };

  const processPayment = async (e) => {
    e.preventDefault();
    const res = await authFetch(`/api/crm/customers/${activeProfile.id}/pay`, {
      method: 'POST',
      body: JSON.stringify({ amount: paymentAmount, durationMonths: 1 })
    });
    if (res.ok) {
      alert("Payment recorded! 7.5% VAT calculated and pushed to Income Day Book.");
      setActiveProfile(null);
      setPaymentAmount('');
      refreshSystemData();
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <header className="bg-slate-900 text-white p-6 rounded-2xl shadow-md flex justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-lg"><Users className="w-6 h-6"/></div>
          <div>
            <h1 className="text-xl font-bold">CRM Desk <span className="text-xs bg-blue-500/30 text-blue-300 px-2 rounded-full">Active Profiles</span></h1>
            <p className="text-xs text-slate-400">Manage subscribers, view tickets, and process renewals</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".xlsx, .csv" ref={fileInputRef} onChange={handleBulkImport} className="hidden" />
          <button onClick={() => fileInputRef.current.click()} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
            <Upload className="w-4 h-4"/> Bulk Import
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map(k => (
          <div key={k.title} className="bg-white p-4 rounded-xl border">
            <p className="text-xs text-slate-500 font-bold uppercase">{k.title}</p>
            <p className={`text-2xl font-black mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white p-4 rounded-xl border flex gap-3">
        <Search className="w-5 h-5 text-slate-400 mt-2" />
        <input type="text" placeholder="Search by name, MAC, or Voix Number..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full text-sm outline-none" />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
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
                  <button onClick={() => setActiveProfile(c)} className="text-xs font-bold bg-slate-900 text-white px-3 py-1.5 rounded hover:bg-slate-800">Profile</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeProfile && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="font-bold text-xl">{activeProfile.name}</h3>
            <p className="font-mono text-sm text-blue-600 font-bold mb-4">{activeProfile.voix_no}</p>
            
            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
              <div className="bg-slate-50 p-3 rounded border"><strong>MAC:</strong> {activeProfile.mac_address}</div>
              <div className="bg-slate-50 p-3 rounded border"><strong>IP:</strong> {activeProfile.ip_address}</div>
              <div className="bg-slate-50 p-3 rounded border col-span-2"><strong>Address:</strong> {activeProfile.address}</div>
            </div>

            <form onSubmit={processPayment} className="border-t pt-4">
              <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><CreditCard className="w-4 h-4"/> Record Payment</h4>
              <div className="flex gap-2">
                <input type="number" required placeholder="Amount (₦)" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full border p-2 rounded" />
                <button type="submit" className="bg-emerald-600 text-white font-bold px-4 py-2 rounded whitespace-nowrap">Pay & Post to Ledger</button>
              </div>
            </form>
            <div className="mt-4 text-right">
              <button onClick={() => setActiveProfile(null)} className="text-slate-500 font-bold text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}