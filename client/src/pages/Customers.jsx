import React, { useState, useContext, useRef, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { Users, Upload, Search, Plus, CreditCard } from 'lucide-react';

export default function Customers() {
  const { customers, tickets, ledger, authFetch, refreshSystemData, hasRole, user } = useContext(AppContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeProfile, setActiveProfile] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    voix_no: '', name: '', mac_address: '', customer_type: 'FTTH', payment_schedule: 'Monthly',
    amount_payable: '', amount_paid: '', bank_received: '', last_payment_date: '', next_due_date: '', outstanding_balance: '', address: '', email: '', phone: ''
  });

  const [paymentData, setPaymentData] = useState({
    date: new Date().toISOString().split('T')[0], amount: '', method: 'Bank Transfer', reference: '',
    durationMonths: 1, customMonths: '', isVatExempt: false, vatCalculationType: 'INCLUSIVE',
    receivedBy: user?.fullname || 'Customer Service'
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

  const openPaymentForProfile = (profile) => {
    setPaymentData({ 
      ...paymentData, 
      date: new Date().toISOString().split('T')[0], amount: '', method: 'Bank Transfer', reference: '',
      durationMonths: 1, customMonths: '', isVatExempt: false, vatCalculationType: 'INCLUSIVE',
      receivedBy: user?.fullname || 'Customer Service' 
    });
    setIsPaymentModalOpen(true);
  };

  // Payment Logic Engine
  const calculatedDueDate = useMemo(() => {
    if (!paymentData.date || paymentData.durationMonths === 0) return '';
    const monthsToAdd = paymentData.durationMonths === -1 ? (parseInt(paymentData.customMonths) || 1) : paymentData.durationMonths;
    if (monthsToAdd <= 0) return '';
    const pDate = new Date(paymentData.date);
    if (isNaN(pDate.getTime())) return '';
    pDate.setMonth(pDate.getMonth() + monthsToAdd);
    return pDate.toISOString().split('T')[0];
  }, [paymentData.date, paymentData.durationMonths, paymentData.customMonths]);

  const calculatedTax = useMemo(() => {
    const gross = parseFloat(paymentData.amount) || 0;
    if (gross <= 0) return { gross: 0, vat: 0, net: 0 };
    if (paymentData.isVatExempt) return { gross, vat: 0, net: gross };

    if (paymentData.vatCalculationType === 'INCLUSIVE') {
      const net = gross / 1.075;
      const vat = gross - net;
      return { gross, vat, net };
    } else {
      const vat = gross * 0.075;
      const totalGross = gross + vat;
      return { gross: totalGross, vat, net: gross };
    }
  }, [paymentData.amount, paymentData.isVatExempt, paymentData.vatCalculationType]);

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const monthsNum = paymentData.durationMonths === -1 ? (parseInt(paymentData.customMonths) || 1) : paymentData.durationMonths;
    
    // 1. Post to Accounting Ledger
    const ledgerPayload = {
      entry_date: paymentData.date,
      inv_no: paymentData.reference || `REC-${Date.now().toString().slice(-6)}`,
      customer_name: activeProfile.name,
      customer_type: activeProfile.customer_type || 'FTTH',
      type: 'Income',
      category: 'Monthly Bandwidth Subscription',
      description: `Subscription Renewal (${monthsNum} Months)`,
      gross_amount: calculatedTax.gross,
      is_vat_exempt: paymentData.isVatExempt ? 1 : 0,
      vat_rate: paymentData.isVatExempt ? 0 : 7.5,
      vat_amount: calculatedTax.vat,
      net_amount: calculatedTax.net,
      payment_mode: paymentData.method,
      duration_months: monthsNum,
      next_due_date: calculatedDueDate,
      received_by: paymentData.receivedBy || 'Customer Service',
      reference_id: activeProfile.id
    };

    await authFetch('/api/accounting/ledger', { method: 'POST', body: JSON.stringify(ledgerPayload) });

    // 2. Update Customer Balances
    const custPayload = {
      amount_paid: paymentData.amount,
      last_payment_date: paymentData.date,
      next_due_date: calculatedDueDate
    };

    await authFetch(`/api/crm/customers/${activeProfile.id}/payment`, { method: 'PATCH', body: JSON.stringify(custPayload) });

    setIsPaymentModalOpen(false);
    setPaymentData({
      date: new Date().toISOString().split('T')[0], amount: '', method: 'Bank Transfer', reference: '',
      durationMonths: 1, customMonths: '', isVatExempt: false, vatCalculationType: 'INCLUSIVE',
      receivedBy: user?.fullname || 'Customer Service'
    });
    alert('Payment successfully recorded and posted to the ledger.');
    
    setActiveProfile(null);
    refreshSystemData();
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
        <input type="text" placeholder="Search by name, MAC, or Voix No..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400 font-medium" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto w-full shadow-sm custom-scrollbar">
        <table className="w-full text-left text-sm min-w-[700px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr><th className="p-3 text-slate-800">Voix No.</th><th className="p-3 text-slate-800">Customer Name</th><th className="p-3 text-slate-800">Plan & IP</th><th className="p-3 text-right text-slate-800">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-mono font-bold text-blue-700">{c.voix_no}</td>
                <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{c.name}</td>
                <td className="p-3"><p className="whitespace-nowrap text-slate-800 font-medium">{c.service_plan}</p><p className="text-xs font-mono text-slate-600">{c.ip_address}</p></td>
                <td className="p-3 text-right"><button onClick={() => setActiveProfile(c)} className="text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg shadow-sm transition whitespace-nowrap">Rich Profile</button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-600 font-medium">No customers found.</td></tr>}
          </tbody>
        </table>
      </div>

      {activeProfile && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-40">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 border-b border-slate-200 pb-4">
              <h3 className="font-bold text-xl sm:text-2xl leading-tight text-slate-900">{activeProfile.name} <br className="sm:hidden" /><span className="text-xs sm:text-sm font-mono bg-blue-100 text-blue-900 px-2 py-0.5 rounded sm:ml-2 border border-blue-200 shadow-sm">{activeProfile.voix_no}</span></h3>
              <button onClick={() => openPaymentForProfile(activeProfile)} className="font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 sm:py-2 rounded-lg w-full sm:w-auto transition shadow-sm flex items-center justify-center gap-1.5"><CreditCard className="w-4 h-4"/> Record Payment</button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-6">
              <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg text-slate-900"><strong className="text-slate-800">Status:</strong><br/><span className="font-medium text-slate-700">{activeProfile.status}</span></div>
              <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg text-slate-900"><strong className="text-slate-800">Schedule:</strong><br/><span className="font-medium text-slate-700">{activeProfile.payment_schedule}</span></div>
              <div className="bg-red-50 text-red-900 p-3 border border-red-200 rounded-lg"><strong className="text-red-900">Balance:</strong><br/><span className="font-mono font-bold text-sm">₦{Number(activeProfile.outstanding_balance || 0).toLocaleString()}</span></div>
              <div className="bg-emerald-50 text-emerald-900 p-3 border border-emerald-200 rounded-lg"><strong className="text-emerald-900">Next Due:</strong><br/><span className="font-mono font-bold text-sm">{activeProfile.next_due_date || '-'}</span></div>
              <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg md:col-span-2 text-slate-900"><strong className="text-slate-800">MAC:</strong><br/><span className="font-mono text-[11px] break-all text-slate-600">{activeProfile.mac_address}</span></div>
              <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg md:col-span-2 text-slate-900"><strong className="text-slate-800">IP:</strong><br/><span className="font-mono text-[11px] break-all text-slate-600">{activeProfile.ip_address}</span></div>
              <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg sm:col-span-2 md:col-span-4 text-slate-900"><strong className="text-slate-800">Address:</strong><br/><span className="text-slate-700 font-medium">{activeProfile.address}</span></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <h4 className="font-bold text-slate-900 border-b border-slate-300 pb-2 mb-3">Support & Interaction Log</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                  {getProfileData(activeProfile.id, activeProfile.name).linkedTickets.map(t => (
                     <div key={t.id} className="text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-900">
                       <span className="font-bold text-blue-800">{t.id} ({t.status}):</span> <span className="font-medium">{t.description}</span>
                       <p className="text-[10px] text-slate-600 mt-1 font-bold">{t.date_received} - {t.query_type}</p>
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
                       <span className="font-bold font-mono text-emerald-800 text-sm">₦{l.gross_amount.toLocaleString()}</span>
                     </div>
                  ))}
                  {getProfileData(activeProfile.id, activeProfile.name).history.length === 0 && <p className="text-xs text-slate-500 font-medium">No financial history.</p>}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end mt-4 pt-4 border-t border-slate-200 gap-2">
              <button onClick={() => setActiveProfile(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold px-4 py-2.5 sm:py-2 rounded-lg w-full sm:w-auto transition shadow-sm">Close Profile</button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {isPaymentModalOpen && activeProfile && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-[60]">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <h3 className="font-bold text-lg mb-4 border-b border-slate-200 pb-2 text-slate-900 flex items-center gap-2"><CreditCard className="w-5 h-5 text-emerald-600"/> Record Payment</h3>
            
            <form onSubmit={handleRecordPayment} className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-900 block mb-1">Customer / Enterprise</label>
                <input type="text" readOnly value={activeProfile.name} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-200 text-slate-700 font-bold" />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-900 block mb-1">Payment Date</label>
                <input type="date" required value={paymentData.date} onChange={e => setPaymentData({...paymentData, date: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 font-bold" />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-900 block mb-1">Payment Method</label>
                <select value={paymentData.method} onChange={e => setPaymentData({...paymentData, method: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 font-bold">
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card Payment">Card Payment</option>
                  <option value="Direct Debit">Direct Debit</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              
              <div>
                <label className="text-[10px] font-bold text-slate-900 block mb-1">Payment Reference (e.g. Teller No.)</label>
                <input type="text" placeholder="Auto-generated if blank" value={paymentData.reference} onChange={e => setPaymentData({...paymentData, reference: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder:text-slate-400 font-mono" />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-900 block mb-1">Duration Cycle</label>
                <select value={paymentData.durationMonths} onChange={e => setPaymentData({...paymentData, durationMonths: parseInt(e.target.value)})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 font-bold">
                  <option value={1}>1 Month (Monthly)</option>
                  <option value={3}>3 Months (Quarterly)</option>
                  <option value={6}>6 Months (Bi-Annual)</option>
                  <option value={12}>12 Months (1 Year)</option>
                  <option value={-1}>Custom Duration</option>
                </select>
              </div>

              {paymentData.durationMonths === -1 && (
                <div>
                  <label className="text-[10px] font-bold text-slate-900 block mb-1">Custom Months</label>
                  <input type="number" min="1" value={paymentData.customMonths} onChange={e => setPaymentData({...paymentData, customMonths: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 font-bold" />
                </div>
              )}

              <div className={paymentData.durationMonths === -1 ? '' : 'sm:col-span-2'}>
                <label className="text-[10px] font-bold text-slate-900 block mb-1">Next Due Date (Auto-Calculated)</label>
                <input type="date" readOnly value={calculatedDueDate} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-200 text-slate-800 font-bold" />
              </div>

              <div className="sm:col-span-2 bg-amber-50 border border-amber-200 p-3.5 rounded-xl space-y-3 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold text-amber-900">💰 Amount & Auto-VAT Engine</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={paymentData.isVatExempt} onChange={e => setPaymentData({...paymentData, isVatExempt: e.target.checked})} className="rounded text-emerald-600 border-slate-400" />
                    <span className="text-[11px] font-bold text-slate-900">VAT Exempt</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-900 block mb-1">Gross Amount (₦)</label>
                    <input type="number" required placeholder="0.00" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 font-mono font-bold placeholder:text-slate-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-900 block mb-1">Calculation Type</label>
                    <select disabled={paymentData.isVatExempt} value={paymentData.vatCalculationType} onChange={e => setPaymentData({...paymentData, vatCalculationType: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white disabled:bg-slate-100 text-slate-900 font-bold">
                      <option value="INCLUSIVE">Inclusive (7.5% Inside Total)</option>
                      <option value="EXCLUSIVE">Exclusive (+7.5% Added)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-200 font-mono text-[10px] sm:text-xs text-slate-900 whitespace-nowrap">
                  <div className="font-bold">Gross: ₦{calculatedTax.gross.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                  <div className="text-amber-800 font-bold">VAT: ₦{calculatedTax.vat.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                  <div className="text-emerald-800 font-bold">Net: ₦{calculatedTax.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-900 block mb-1">Received By</label>
                <input type="text" required value={paymentData.receivedBy} onChange={e => setPaymentData({...paymentData, receivedBy: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 font-bold" />
              </div>

              <div className="sm:col-span-2 flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200 mt-2">
                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2.5 sm:py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg text-sm w-full sm:w-auto transition shadow-sm">Cancel</button>
                <button type="submit" className="px-4 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm shadow-sm w-full sm:w-auto transition">Post Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL BOARDING MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-lg mb-4 border-b border-slate-200 pb-2 text-slate-900">Manual Customer Boarding</h3>
            <form onSubmit={handleManualAdd} className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <div><label className="text-[10px] text-slate-900 font-bold block mb-1">Voix Number</label><input type="text" placeholder="Auto-gen if blank" onChange={e => setFormData({...formData, voix_no: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder:text-slate-500" /></div>
              <div className="md:col-span-2"><label className="text-[10px] text-slate-900 font-bold block mb-1">Customer Name</label><input type="text" required placeholder="Customer Name" onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder:text-slate-500" /></div>
              
              <div><label className="text-[10px] text-slate-900 font-bold block mb-1">MAC Address</label><input type="text" placeholder="MAC Address" onChange={e => setFormData({...formData, mac_address: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder:text-slate-500" /></div>
              <div><label className="text-[10px] text-slate-900 font-bold block mb-1">Customer Type</label><select onChange={e => setFormData({...formData, customer_type: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 font-bold"><option>FTTH</option><option>Enterprise</option></select></div>
              <div><label className="text-[10px] text-slate-900 font-bold block mb-1">Payment Schedule</label><select onChange={e => setFormData({...formData, payment_schedule: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 font-bold"><option>Monthly</option><option>Quarterly</option><option>Bi-Annual</option><option>Annual</option></select></div>
              
              <div><label className="text-[10px] text-slate-900 font-bold block mb-1">Amount Payable (₦)</label><input type="number" placeholder="Amount Payable (₦)" onChange={e => setFormData({...formData, amount_payable: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-500" /></div>
              <div><label className="text-[10px] text-slate-900 font-bold block mb-1">Amount Paid (₦)</label><input type="number" placeholder="Amount Paid (₦)" onChange={e => setFormData({...formData, amount_paid: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-500" /></div>
              <div><label className="text-[10px] text-slate-900 font-bold block mb-1">Outstanding Balance (₦)</label><input type="number" placeholder="Outstanding Balance (₦)" onChange={e => setFormData({...formData, outstanding_balance: e.target.value})} className="w-full border border-red-300 p-2.5 rounded-lg text-sm bg-red-50 text-red-900 placeholder:text-red-500 font-bold" /></div>
              
              <div><label className="text-[10px] text-slate-900 font-bold block mb-1">Bank Received</label><input type="text" placeholder="Bank Received" onChange={e => setFormData({...formData, bank_received: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder:text-slate-500" /></div>
              <div><label className="text-[10px] text-slate-900 font-bold block mb-1">Last Payment Date</label><input type="date" onChange={e => setFormData({...formData, last_payment_date: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900" /></div>
              <div><label className="text-[10px] text-slate-900 font-bold block mb-1">Next Due Date</label><input type="date" onChange={e => setFormData({...formData, next_due_date: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900" /></div>
              
              <div className="md:col-span-3"><label className="text-[10px] text-slate-900 font-bold block mb-1">Physical Address</label><input type="text" required placeholder="Physical Address" onChange={e => setFormData({...formData, address: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder:text-slate-500" /></div>
              <div className="md:col-span-2"><label className="text-[10px] text-slate-900 font-bold block mb-1">Email Address</label><input type="email" placeholder="Email Address" onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder:text-slate-500" /></div>
              <div><label className="text-[10px] text-slate-900 font-bold block mb-1">Phone Number</label><input type="text" placeholder="Phone Number" onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder:text-slate-500" /></div>
              
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