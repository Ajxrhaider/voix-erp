import React, { useState, useContext, useEffect, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { Headset, Plus, AlertTriangle, FileText, Printer, Trash2, CreditCard } from 'lucide-react';

export default function CustomerService() {
  const { tickets, customers, authFetch, refreshSystemData, hasRole, user } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('queries');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [closingTicket, setClosingTicket] = useState(null);
  const [ccReports, setCcReports] = useState([]);
  const [viewingReport, setViewingReport] = useState(null);
  
  const [formData, setFormData] = useState({
    date_received: new Date().toISOString().split('T')[0], time_received: '', customer_ip: '', customer_name: '', query_type: '',
    location: '', service_type: 'FTTH', description: '', whatsapp_sos_sent: false, assigned_to: '', priority: 'Medium'
  });

  const [paymentData, setPaymentData] = useState({
    customer_id: '', customer_name: '', date: new Date().toISOString().split('T')[0], amount: '', 
    method: 'Bank Transfer', reference: '', durationMonths: 1, customMonths: '', isVatExempt: false, vatCalculationType: 'INCLUSIVE',
    receivedBy: user?.fullname || 'Customer Service'
  });

  const getInitialReportData = () => ({
    report_date: new Date().toISOString().split('T')[0],
    channels: { 
      phone: { success: 0, pending: 0 }, 
      whatsapp: { success: 0, pending: 0 }, 
      email: { success: 0, pending: 0 }, 
      in_person: { success: 0, pending: 0 } 
    },
    interactions: [], 
    ticketing: { new: 0, resolved: 0, escalated: 0, top_issues: '' },
    financial: { received: 0, value: 0, methods: '', discrepancies: 'NONE' },
    social: { posts: 0, replies: 0, followers: 0, platforms: '' },
    summary: { highlights: '', action_items: '' }
  });

  const [reportData, setReportData] = useState(getInitialReportData());

  useEffect(() => {
    if (activeTab === 'report-history') {
      authFetch('/api/tickets/cc-reports').then(res => res.json()).then(setCcReports);
    }
  }, [activeTab]);

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    await authFetch('/api/tickets', { method: 'POST', body: JSON.stringify(formData) });
    setIsModalOpen(false);
    refreshSystemData();
  };

  const handleCloseTicket = async (e) => {
    e.preventDefault();
    await authFetch(`/api/tickets/${closingTicket.id}/close`, { method: 'PATCH', body: JSON.stringify(closingTicket) });
    setClosingTicket(null);
    refreshSystemData();
  };

  const handleEscalate = async (id) => {
    if (window.confirm("Are you sure you want to escalate this ticket to Management?")) {
      await authFetch(`/api/tickets/${id}/escalate`, { method: 'PATCH' });
      refreshSystemData();
    }
  };

  const handleAddInteraction = () => {
    setReportData({
      ...reportData,
      interactions: [...reportData.interactions, { account_id: '', issue: '', recorded_in: 'NIL', profile_updated: 'NIL', vncl_updated: 'NIL', status: 'OPEN' }]
    });
  };

  const handleUpdateInteraction = (index, field, value) => {
    const newInteractions = [...reportData.interactions];
    newInteractions[index][field] = value;
    setReportData({ ...reportData, interactions: newInteractions });
  };

  const handleUpdateChannel = (channel, field, value) => {
    setReportData({
      ...reportData,
      channels: { ...reportData.channels, [channel]: { ...reportData.channels[channel], [field]: value } }
    });
  };

  const handleRemoveInteraction = (index) => {
    const newInteractions = reportData.interactions.filter((_, i) => i !== index);
    setReportData({ ...reportData, interactions: newInteractions });
  };

  const handleSubmitCCReport = async (e) => {
    e.preventDefault();
    await authFetch('/api/tickets/cc-reports', { method: 'POST', body: JSON.stringify(reportData) });
    alert("Official Customer Care Activity Report successfully logged.");
    setReportData(getInitialReportData());
    setActiveTab('report-history');
  };

  const parseChannel = (data) => {
    if (!data) return { success: 0, pending: 0 };
    if (typeof data === 'object') return { success: data.success || 0, pending: data.pending || 0 };
    return { success: data || 0, pending: 0 };
  };

  // Payment Logic Engine
  const calculatedDueDate = useMemo(() => {
    if (!paymentData.date || paymentData.durationMonths === 0) return '';
    const monthsToAdd = paymentData.durationMonths === -1 ? (parseInt(paymentData.customMonths) || 1) : paymentData.durationMonths;
    if (monthsToAdd <= 0) return '';
    const d = new Date(paymentData.date);
    if (isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + monthsToAdd);
    return d.toISOString().split('T')[0];
  }, [paymentData.date, paymentData.durationMonths, paymentData.customMonths]);

  const calculatedTax = useMemo(() => {
    const gross = parseFloat(paymentData.amount) || 0;
    if (gross <= 0) return { gross: 0, vat: 0, net: 0 };
    if (paymentData.isVatExempt) return { gross, vat: 0, net: gross };
    if (paymentData.vatCalculationType === 'INCLUSIVE') {
      const net = gross / 1.075; return { gross, vat: gross - net, net };
    } else {
      const vat = gross * 0.075; return { gross: gross + vat, vat, net: gross };
    }
  }, [paymentData.amount, paymentData.isVatExempt, paymentData.vatCalculationType]);

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentData.customer_id) return alert("Please select a valid customer from the dropdown list.");
    
    const monthsNum = paymentData.durationMonths === -1 ? (parseInt(paymentData.customMonths) || 1) : paymentData.durationMonths;
    const custType = customers.find(c => c.id === paymentData.customer_id)?.customer_type || 'FTTH';

    await authFetch('/api/accounting/ledger', { method: 'POST', body: JSON.stringify({
      entry_date: paymentData.date, inv_no: paymentData.reference || `REC-${Date.now().toString().slice(-6)}`,
      customer_name: paymentData.customer_name, customer_type: custType, type: 'Income', category: 'Monthly Bandwidth Subscription',
      description: `Subscription Renewal (${monthsNum} Months)`, gross_amount: calculatedTax.gross, is_vat_exempt: paymentData.isVatExempt ? 1 : 0,
      vat_rate: paymentData.isVatExempt ? 0 : 7.5, vat_amount: calculatedTax.vat, net_amount: calculatedTax.net, payment_mode: paymentData.method,
      duration_months: monthsNum, next_due_date: calculatedDueDate, received_by: paymentData.receivedBy, reference_id: paymentData.customer_id
    })});

    await authFetch(`/api/crm/customers/${paymentData.customer_id}/payment`, { method: 'PATCH', body: JSON.stringify({
      amount_paid: paymentData.amount, last_payment_date: paymentData.date, next_due_date: calculatedDueDate
    })});

    setIsPaymentModalOpen(false);
    setPaymentData({ customer_id: '', customer_name: '', date: new Date().toISOString().split('T')[0], amount: '', method: 'Bank Transfer', reference: '', durationMonths: 1, customMonths: '', isVatExempt: false, vatCalculationType: 'INCLUSIVE', receivedBy: user?.fullname || 'Customer Service' });
    alert('Payment successfully recorded and posted to the ledger.');
    refreshSystemData();
  };

  return (
    <ModuleLayout
      title="Customer Service & Queries"
      subtitle="Ticketing, Triage, and Official CC Reports"
      icon={<Headset className="w-6 h-6" />}
      tabs={[
        { id: 'queries', label: 'Active Queries' }, 
        { id: 'report-new', label: 'Log Daily Activity' },
        { id: 'report-history', label: 'Report Archives' }
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerActions={
        activeTab === 'queries' && hasRole(['NOC', 'Customer Service', 'Management', 'Dev']) && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button onClick={() => setIsPaymentModalOpen(true)} className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm transition"><CreditCard className="w-4 h-4"/> Record Subscription Payment</button>
            <button onClick={() => setIsModalOpen(true)} className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm transition"><Plus className="w-4 h-4"/> Log New Query</button>
          </div>
        )
      }
    >
      {/* TAB: ACTIVE QUERIES */}
      {activeTab === 'queries' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          {tickets.filter(t => t.status !== 'Closed').map(t => (
            <div key={t.id} className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between transition hover:shadow-md">
              <div>
                <div className="flex items-center gap-2 mb-1 justify-between">
                  <p className="font-mono text-[11px] sm:text-xs font-bold text-slate-600">{t.id} • {t.query_type || t.category}</p>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${t.status === 'Resolved' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>{t.status}</span>
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-1 leading-tight">{t.customer_name}</h3>
                <p className="text-sm text-slate-700">{t.description}</p>
                <div className="text-[11px] sm:text-xs text-slate-600 mt-3 bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-wrap gap-x-4 gap-y-1">
                  <span className="font-medium"><strong className="text-slate-800">Loc:</strong> {t.location}</span>
                  <span className="font-medium"><strong className="text-slate-800">IP:</strong> <span className="font-mono">{t.customer_ip}</span></span>
                  {t.priority === 'High' && <span className="font-bold text-red-700">URGENT PRIORITY</span>}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-slate-200">
                {t.status !== 'Resolved' && t.status !== 'Escalated' && (
                  <button onClick={() => handleEscalate(t.id)} className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold px-4 py-2.5 sm:py-2 rounded-lg text-xs transition flex items-center justify-center gap-1 shadow-sm w-full sm:w-auto"><AlertTriangle className="w-3.5 h-3.5"/> Escalate</button>
                )}
                {(t.status === 'Resolved' || hasRole(['Management', 'Dev'])) && (
                  <button onClick={() => setClosingTicket(t)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 sm:py-2 rounded-lg text-xs transition shadow-sm w-full sm:w-auto">Close Query</button>
                )}
              </div>
            </div>
          ))}
          {tickets.filter(t => t.status !== 'Closed').length === 0 && <p className="text-slate-600 font-medium p-4 col-span-2">No active queries found.</p>}
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <h3 className="font-bold text-lg mb-4 border-b border-slate-200 pb-2 text-slate-900 flex items-center gap-2"><CreditCard className="w-5 h-5 text-emerald-600"/> Record Subscription Payment</h3>
            <form onSubmit={handleRecordPayment} className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-900 block mb-1">Search Customer Profile</label>
                <input list="pay-customers" required placeholder="Type customer name or Voix No..." value={paymentData.customer_name} onChange={e => {
                  const match = customers.find(c => c.name === e.target.value || c.voix_no === e.target.value);
                  setPaymentData({...paymentData, customer_name: e.target.value, customer_id: match ? match.id : ''});
                }} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400 font-bold" />
                <datalist id="pay-customers">{customers.map(c => <option key={c.id} value={c.name}>{c.voix_no}</option>)}</datalist>
              </div>

              <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Payment Date</label><input type="date" required value={paymentData.date} onChange={e => setPaymentData({...paymentData, date: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 font-bold" /></div>
              <div>
                <label className="text-[10px] font-bold text-slate-900 block mb-1">Payment Method</label>
                <select value={paymentData.method} onChange={e => setPaymentData({...paymentData, method: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 font-bold">
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card Payment">Card Payment</option>
                  <option value="Direct Debit">Direct Debit</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              
              <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Reference / Receipt No.</label><input type="text" placeholder="Auto-generated if blank" value={paymentData.reference} onChange={e => setPaymentData({...paymentData, reference: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400 font-mono" /></div>
              <div>
                <label className="text-[10px] font-bold text-slate-900 block mb-1">Duration Cycle</label>
                <select value={paymentData.durationMonths} onChange={e => setPaymentData({...paymentData, durationMonths: parseInt(e.target.value)})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 font-bold">
                  <option value={1}>1 Month (Monthly)</option>
                  <option value={3}>3 Months (Quarterly)</option>
                  <option value={6}>6 Months (Bi-Annual)</option>
                  <option value={12}>12 Months (1 Year)</option>
                  <option value={0}>One-off Payment</option>
                  <option value={-1}>Custom Duration</option>
                </select>
              </div>

              {paymentData.durationMonths === -1 && (
                <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Custom Months</label><input type="number" min="1" value={paymentData.customMonths} onChange={e => setPaymentData({...paymentData, customMonths: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 font-bold" /></div>
              )}

              <div className={paymentData.durationMonths === -1 ? '' : 'sm:col-span-2'}>
                <label className="text-[10px] font-bold text-slate-900 block mb-1">Next Due Date (Auto-Calculated)</label>
                <input type="date" readOnly value={calculatedDueDate} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-200 text-slate-800 font-bold" />
              </div>

              <div className="sm:col-span-2 bg-amber-50 border border-amber-200 p-3.5 rounded-xl space-y-3 mt-2">
                <div className="flex items-center justify-between"><span className="text-[11px] sm:text-xs font-bold text-amber-900">💰 Amount & Auto-VAT Engine</span><label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={paymentData.isVatExempt} onChange={e => setPaymentData({...paymentData, isVatExempt: e.target.checked})} className="rounded text-emerald-600 border-slate-400" /><span className="text-[11px] font-bold text-slate-900">VAT Exempt</span></label></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Gross Amount (₦)</label><input type="number" required placeholder="0.00" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 font-mono font-bold placeholder-slate-400" /></div>
                  <div><label className="text-[10px] font-bold text-slate-900 block mb-1">Calculation Type</label><select disabled={paymentData.isVatExempt} value={paymentData.vatCalculationType} onChange={e => setPaymentData({...paymentData, vatCalculationType: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white disabled:bg-slate-100 text-slate-900 font-bold"><option value="INCLUSIVE">Inclusive (7.5% Inside Total)</option><option value="EXCLUSIVE">Exclusive (+7.5% Added)</option></select></div>
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

      {/* TAB: NEW DAILY REPORT */}
      {activeTab === 'report-new' && (
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm w-full">
          <div className="border-b border-slate-200 pb-3 mb-6 flex flex-col sm:flex-row sm:items-center justify-between">
            <h3 className="font-bold text-lg sm:text-xl text-slate-900">Create Daily Customer Care Activity Report</h3>
            <p className="text-xs font-bold text-slate-600 mt-2 sm:mt-0">Rep: <span className="text-slate-900">{user?.fullname}</span></p>
          </div>

          <form onSubmit={handleSubmitCCReport} className="space-y-6 text-sm">
            <div className="flex gap-4">
              <div>
                <label className="text-xs font-bold block mb-1 text-slate-900">Report Date</label>
                <input type="date" required value={reportData.report_date} onChange={e => setReportData({...reportData, report_date: e.target.value})} className="border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900" />
              </div>
            </div>

            {/* 1. Interaction Channels */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
               <h4 className="sm:col-span-2 md:col-span-4 font-bold text-slate-900 mb-1">1. Interaction Overview</h4>
               
               {['phone', 'whatsapp', 'email', 'in_person'].map(ch => (
                 <div key={ch} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                   <p className="font-bold text-[11px] text-slate-800 uppercase mb-2 border-b pb-1">{ch.replace('_', ' ')}</p>
                   <div className="grid grid-cols-2 gap-2">
                     <div>
                       <label className="text-[9px] font-bold text-slate-600 block mb-1">Successful</label>
                       <input type="number" min="0" value={reportData.channels[ch].success} onChange={e => handleUpdateChannel(ch, 'success', e.target.value)} className="w-full border border-slate-300 p-2 rounded text-xs bg-slate-50 text-slate-900" />
                     </div>
                     <div>
                       <label className="text-[9px] font-bold text-slate-600 block mb-1">Pending</label>
                       <input type="number" min="0" value={reportData.channels[ch].pending} onChange={e => handleUpdateChannel(ch, 'pending', e.target.value)} className="w-full border border-slate-300 p-2 rounded text-xs bg-slate-50 text-slate-900" />
                     </div>
                   </div>
                 </div>
               ))}
            </div>

            {/* 2. Customer Interaction Log */}
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-slate-900">2. Customer Interaction Log</h4>
                <button type="button" onClick={handleAddInteraction} className="bg-slate-200 hover:bg-slate-300 text-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"><Plus className="w-3 h-3"/> Add Entry</button>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs min-w-[900px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-2 w-8 text-slate-900 font-bold">S/N</th>
                      <th className="p-2 min-w-[150px] text-slate-900 font-bold">ID / Account Number</th>
                      <th className="p-2 min-w-[200px] text-slate-900 font-bold">Issue / Nature of Interaction</th>
                      <th className="p-2 text-slate-900 font-bold">VNQ / VND</th>
                      <th className="p-2 text-slate-900 font-bold">Update Profile</th>
                      <th className="p-2 text-slate-900 font-bold">Update VNCL</th>
                      <th className="p-2 text-center text-slate-900 font-bold">Status</th>
                      <th className="p-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.interactions.map((interaction, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 font-mono text-slate-600 font-bold">{idx + 1}</td>
                        <td className="p-2">
                          <input list="customers-list" type="text" placeholder="VN-..." value={interaction.account_id} onChange={(e) => handleUpdateInteraction(idx, 'account_id', e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg font-mono text-[10px] text-slate-900 bg-white placeholder-slate-400" />
                        </td>
                        <td className="p-2">
                          <input type="text" placeholder="Describe interaction..." value={interaction.issue} onChange={(e) => handleUpdateInteraction(idx, 'issue', e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg text-slate-900 bg-white placeholder-slate-400" />
                        </td>
                        <td className="p-2">
                          <select value={interaction.recorded_in} onChange={(e) => handleUpdateInteraction(idx, 'recorded_in', e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg text-slate-900 bg-white font-bold"><option>NIL</option><option>VNQ</option><option>VND</option></select>
                        </td>
                        <td className="p-2">
                          <select value={interaction.profile_updated} onChange={(e) => handleUpdateInteraction(idx, 'profile_updated', e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg text-slate-900 bg-white font-bold"><option>NIL</option><option>YES</option></select>
                        </td>
                        <td className="p-2">
                          <select value={interaction.vncl_updated} onChange={(e) => handleUpdateInteraction(idx, 'vncl_updated', e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg text-slate-900 bg-white font-bold"><option>NIL</option><option>YES</option></select>
                        </td>
                        <td className="p-2">
                          <select value={interaction.status} onChange={(e) => handleUpdateInteraction(idx, 'status', e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg font-bold text-slate-900 bg-white"><option>OPEN</option><option>CLOSED</option></select>
                        </td>
                        <td className="p-2 text-center">
                          <button type="button" onClick={() => handleRemoveInteraction(idx)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded transition"><Trash2 className="w-4 h-4"/></button>
                        </td>
                      </tr>
                    ))}
                    {reportData.interactions.length === 0 && <tr><td colSpan="8" className="p-4 text-center text-slate-500 font-medium">No interactions logged yet.</td></tr>}
                  </tbody>
                </table>
              </div>
              <datalist id="customers-list">
                {customers?.map(c => <option key={c.id} value={c.voix_no}>{c.name}</option>)}
              </datalist>
            </div>
            
            {/* 3. Ticketing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-blue-50 p-4 rounded-xl border border-blue-200">
               <h4 className="sm:col-span-2 md:col-span-4 font-bold text-blue-900 mb-1">3. Ticketing & Issue Tracking</h4>
               <div><label className="text-[10px] font-bold block mb-1 text-slate-900">New Raised</label><input type="number" min="0" value={reportData.ticketing.new} onChange={e => setReportData({...reportData, ticketing: {...reportData.ticketing, new: e.target.value}})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-slate-900 font-mono" /></div>
               <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Resolved</label><input type="number" min="0" value={reportData.ticketing.resolved} onChange={e => setReportData({...reportData, ticketing: {...reportData.ticketing, resolved: e.target.value}})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-slate-900 font-mono" /></div>
               <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Escalated</label><input type="number" min="0" value={reportData.ticketing.escalated} onChange={e => setReportData({...reportData, ticketing: {...reportData.ticketing, escalated: e.target.value}})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-slate-900 font-mono" /></div>
               <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Top 3 Issue Categories</label><input type="text" placeholder="e.g. Service outage, Slow speeds" value={reportData.ticketing.top_issues} onChange={e => setReportData({...reportData, ticketing: {...reportData.ticketing, top_issues: e.target.value}})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-slate-900 placeholder-slate-400" /></div>
            </div>

            {/* 4. Financial & 5. Social */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 space-y-3">
                <h4 className="font-bold text-emerald-900 mb-1">4. Financial Transactions</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Total Payments</label><input type="number" min="0" value={reportData.financial.received} onChange={e => setReportData({...reportData, financial: {...reportData.financial, received: e.target.value}})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-slate-900 font-mono" /></div>
                  <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Value Documented (₦)</label><input type="number" min="0" value={reportData.financial.value} onChange={e => setReportData({...reportData, financial: {...reportData.financial, value: e.target.value}})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-slate-900 font-mono" /></div>
                </div>
                <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Payment Methods</label><input type="text" placeholder="e.g. BANK TRANSFER" value={reportData.financial.methods} onChange={e => setReportData({...reportData, financial: {...reportData.financial, methods: e.target.value}})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-slate-900 placeholder-slate-400" /></div>
                <div><label className="text-[10px] font-bold block mb-1 text-red-900">Discrepancies / Failed Attempts</label><input type="text" placeholder="NONE" value={reportData.financial.discrepancies} onChange={e => setReportData({...reportData, financial: {...reportData.financial, discrepancies: e.target.value}})} className="w-full border border-red-300 p-2.5 rounded-lg bg-red-50 text-slate-900 placeholder-slate-500" /></div>
              </div>

              <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 space-y-3">
                <h4 className="font-bold text-purple-900 mb-1">5. Social Media Engagement</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-bold block mb-1 text-slate-900">New Posts</label><input type="number" min="0" value={reportData.social.posts} onChange={e => setReportData({...reportData, social: {...reportData.social, posts: e.target.value}})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-slate-900 font-mono" /></div>
                  <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Replies/Comments</label><input type="number" min="0" value={reportData.social.replies} onChange={e => setReportData({...reportData, social: {...reportData.social, replies: e.target.value}})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-slate-900 font-mono" /></div>
                  <div><label className="text-[10px] font-bold block mb-1 text-slate-900">New Followers</label><input type="number" min="0" value={reportData.social.followers} onChange={e => setReportData({...reportData, social: {...reportData.social, followers: e.target.value}})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-slate-900 font-mono" /></div>
                </div>
                <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Platforms Active</label><input type="text" placeholder="e.g. Instagram, LinkedIn, Twitter" value={reportData.social.platforms} onChange={e => setReportData({...reportData, social: {...reportData.social, platforms: e.target.value}})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-slate-900 placeholder-slate-400" /></div>
              </div>
            </div>

            {/* 6. Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
               <h4 className="md:col-span-2 font-bold text-slate-900 mb-1">6. Summary & Observations</h4>
               <div>
                 <label className="text-[10px] font-bold block mb-1 text-slate-900">Key Highlights</label>
                 <textarea required value={reportData.summary.highlights} onChange={e => setReportData({...reportData, summary: {...reportData.summary, highlights: e.target.value}})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-slate-900 h-20 placeholder-slate-400" />
               </div>
               <div>
                 <label className="text-[10px] font-bold block mb-1 text-slate-900">Action Items for Tomorrow</label>
                 <textarea required value={reportData.summary.action_items} onChange={e => setReportData({...reportData, summary: {...reportData.summary, action_items: e.target.value}})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-slate-900 h-20 placeholder-slate-400" />
               </div>
            </div>

            <div className="text-right border-t border-slate-200 pt-4 mt-2">
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl w-full sm:w-auto shadow-sm transition">Save Official Report</button>
            </div>
          </form>
        </div>
      )}

      {/* NEW QUERY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <h3 className="font-bold text-lg mb-4 border-b border-slate-200 pb-2 text-slate-900">Log Customer Query</h3>
            <form onSubmit={handleCreateTicket} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Customer Name (Optional)</label><input type="text" placeholder="Customer Name" onChange={e => setFormData({...formData, customer_name: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Date Received</label><input type="date" required value={formData.date_received} onChange={e => setFormData({...formData, date_received: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900" /></div>
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Time</label><input type="text" placeholder="e.g. 09:15 AM" onChange={e => setFormData({...formData, time_received: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Customer IP NUMBER</label><input type="text" placeholder="IP Address" onChange={e => setFormData({...formData, customer_ip: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400 font-mono" /></div>
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Query Type</label><input type="text" required placeholder="Nature of Query" onChange={e => setFormData({...formData, query_type: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Location</label><input type="text" required placeholder="Location" onChange={e => setFormData({...formData, location: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Service Type</label><select value={formData.service_type} onChange={e => setFormData({...formData, service_type: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 font-bold"><option>FTTH</option><option>Enterprise</option></select></div>
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Priority</label><select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 font-bold"><option>Low</option><option>Medium</option><option>High</option></select></div>
              
              <div className="sm:col-span-2 md:col-span-4"><label className="text-[10px] font-bold block mb-1 text-slate-900">Issue Description (Customer's Words OR ERROR Message)</label><textarea required placeholder="Detailed Issue Description" onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg h-24 bg-white text-slate-900 placeholder-slate-400" /></div>
              
              <div className="sm:col-span-2 flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-300"><input type="checkbox" checked={formData.whatsapp_sos_sent} onChange={e => setFormData({...formData, whatsapp_sos_sent: e.target.checked})} className="w-5 h-5 sm:w-4 sm:h-4 rounded text-emerald-600 border-slate-400"/> <label className="text-[11px] font-bold text-slate-900">WhatsApp SOS Sent (Y/N)</label></div>
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Assigned To (Internal Team)</label><input type="text" placeholder="Assigned To (Fiber/NOC Team)" onChange={e => setFormData({...formData, assigned_to: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              
              <div className="sm:col-span-2 md:col-span-4"><label className="text-[10px] font-bold block mb-1 text-slate-900">Ticket Opened By</label><input type="text" value={user?.fullname || 'System'} readOnly className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-200 text-slate-700 font-bold" /></div>
              
              <div className="sm:col-span-2 md:col-span-4 flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 sm:py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg text-sm w-full sm:w-auto transition shadow-sm">Cancel</button>
                <button type="submit" className="px-4 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm shadow-sm w-full sm:w-auto transition">Log Query</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLOSE QUERY MODAL */}
      {closingTicket && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <h3 className="font-bold text-lg mb-4 border-b border-slate-200 pb-2 text-slate-900">Close Ticket: {closingTicket.id}</h3>
            <form onSubmit={handleCloseTicket} className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Query Status</label><select onChange={e => setClosingTicket({...closingTicket, status: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 font-bold"><option value="Resolved">Resolved</option><option value="Closed">Closed</option></select></div>
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Resolution Date/Time</label><input type="datetime-local" onChange={e => setClosingTicket({...closingTicket, resolution_datetime: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900" /></div>
              
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Mean Time to Resolve (MTTR)</label><input type="text" placeholder="e.g. 2 Hours" onChange={e => setClosingTicket({...closingTicket, mttr: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-500" /></div>
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Resolved By (Tech Name)</label><input type="text" placeholder="Technician Name" onChange={e => setClosingTicket({...closingTicket, resolution_by: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-500" /></div>
              
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Customer Feedback</label><textarea placeholder="Customer Feedback / Notes" onChange={e => setClosingTicket({...closingTicket, customer_feedback: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-slate-900 h-20 placeholder-slate-500" /></div>
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Official Closure Notes</label><textarea required placeholder="Detailed Closure Notes" onChange={e => setClosingTicket({...closingTicket, closure_notes: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-slate-900 h-20 placeholder-slate-500" /></div>
              
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Ticket Closed By</label><input type="text" value={user?.fullname || 'System'} readOnly className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-200 text-slate-700 font-bold" /></div>
              
              <div className="sm:col-span-2 flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200 mt-2">
                <button type="button" onClick={() => setClosingTicket(null)} className="px-4 py-2.5 sm:py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg text-sm w-full sm:w-auto transition shadow-sm">Cancel</button>
                <button type="submit" className="px-4 py-2.5 sm:py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-sm shadow-sm w-full sm:w-auto transition">Formally Close Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW / PRINT DAILY REPORT MODAL */}
      {viewingReport && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center p-2 sm:p-6 z-[100] print:p-0 print:bg-white">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden shadow-2xl print:shadow-none print:max-h-none print:h-auto print:rounded-none">
            
            <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-50 no-print shrink-0">
              <h2 className="font-bold text-xl text-slate-900 flex items-center gap-2"><FileText className="text-blue-700"/> Document Viewer</h2>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm transition"><Printer className="w-4 h-4"/> Print</button>
                <button onClick={() => setViewingReport(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold px-4 py-2.5 sm:py-2 rounded-lg text-sm w-full sm:w-auto transition shadow-sm">Close</button>
              </div>
            </div>

            <div className="p-6 sm:p-10 overflow-y-auto custom-scrollbar text-sm print:overflow-visible print:p-4 text-black font-sans print-document">
              
              <div className="text-center mb-8 border-b-2 border-slate-800 pb-4">
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider mb-2 text-slate-900">Daily Customer Care Activity Report</h1>
                <div className="flex justify-between font-bold text-sm sm:text-base mt-4 text-slate-900">
                  <p>Date: <span className="font-normal">{viewingReport.report_date}</span></p>
                  <p>Representative: <span className="font-normal uppercase">{viewingReport.fullname}</span></p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-bold text-lg border-b border-slate-300 pb-1 mb-3 text-slate-900">1. Interaction Overview</h3>
                <p className="text-xs mb-2 text-slate-800">Total volume of customer touchpoints across all primary channels.</p>
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse border border-slate-400 min-w-[500px]">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="border border-slate-400 p-2 text-slate-900 font-bold">Channel</th>
                        <th className="border border-slate-400 p-2 text-slate-900 font-bold text-center">Successful Interactions</th>
                        <th className="border border-slate-400 p-2 text-slate-900 font-bold text-center">Pending/Follow-up</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-900">
                      {['phone', 'whatsapp', 'email', 'in_person'].map(ch => {
                        const parsedChannels = JSON.parse(viewingReport.channels_json || '{}');
                        const data = parsedChannels[ch] || { success: 0, pending: 0 };
                        // Fallback for older data that only had a single number per channel
                        const success = typeof data === 'object' ? data.success || 0 : data || 0;
                        const pending = typeof data === 'object' ? data.pending || 0 : 0;
                        
                        return (
                          <tr key={ch}>
                            <td className="border border-slate-400 p-2 font-bold uppercase text-[11px]">{ch.replace('_', ' ')}</td>
                            <td className="border border-slate-400 p-2 text-center font-mono">{success}</td>
                            <td className="border border-slate-400 p-2 text-center font-mono text-red-700 font-bold">{pending}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-bold text-lg border-b border-slate-300 pb-1 mb-3 text-slate-900">2. Customer Interaction Log</h3>
                <p className="text-xs mb-2 text-slate-800">Detailed record of every customer touchpoint, including identification and specific concerns.</p>
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse border border-slate-400 text-xs min-w-[700px]">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="border border-slate-400 p-2 text-slate-900 font-bold">S/N</th>
                        <th className="border border-slate-400 p-2 text-slate-900 font-bold">ID / Account Number</th>
                        <th className="border border-slate-400 p-2 text-slate-900 font-bold">Issue / Nature of Interaction</th>
                        <th className="border border-slate-400 p-2 text-slate-900 font-bold text-center">VNQ or VND</th>
                        <th className="border border-slate-400 p-2 text-slate-900 font-bold text-center">Update Profile</th>
                        <th className="border border-slate-400 p-2 text-slate-900 font-bold text-center">Update VNCL</th>
                        <th className="border border-slate-400 p-2 text-slate-900 font-bold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-900">
                      {JSON.parse(viewingReport.interaction_log || '[]').map((log, i) => (
                        <tr key={i}>
                          <td className="border border-slate-400 p-2 text-center font-bold">{i + 1}</td>
                          <td className="border border-slate-400 p-2 font-mono font-bold text-blue-800">{log.account_id}</td>
                          <td className="border border-slate-400 p-2 uppercase">{log.issue}</td>
                          <td className="border border-slate-400 p-2 text-center font-bold">{log.recorded_in}</td>
                          <td className="border border-slate-400 p-2 text-center font-bold">{log.profile_updated}</td>
                          <td className="border border-slate-400 p-2 text-center font-bold">{log.vncl_updated}</td>
                          <td className="border border-slate-400 p-2 text-center font-bold">{log.status}</td>
                        </tr>
                      ))}
                      {JSON.parse(viewingReport.interaction_log || '[]').length === 0 && <tr><td colSpan="7" className="border border-slate-400 p-4 text-center font-medium">No individual interactions logged.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6 text-slate-900">
                <div>
                  <h3 className="font-bold text-lg border-b border-slate-300 pb-1 mb-3">3. Ticketing & Issue Tracking</h3>
                  <ul className="space-y-1.5 text-sm">
                    <li><span className="font-bold">New Tickets Raised:</span> {JSON.parse(viewingReport.ticketing_json || '{}').new || 0}</li>
                    <li><span className="font-bold">Tickets Resolved:</span> {JSON.parse(viewingReport.ticketing_json || '{}').resolved || 0}</li>
                    <li><span className="font-bold">Escalated to Technical/Billing:</span> {JSON.parse(viewingReport.ticketing_json || '{}').escalated || 0}</li>
                    <li className="pt-2"><span className="font-bold">Top 3 Issue Categories:</span> <br/><span className="uppercase text-slate-700">{JSON.parse(viewingReport.ticketing_json || '{}').top_issues || 'N/A'}</span></li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-lg border-b border-slate-300 pb-1 mb-3">4. Financial Transactions</h3>
                  <ul className="space-y-1.5 text-sm">
                    <li><span className="font-bold">Total Payments Received:</span> {JSON.parse(viewingReport.financial_json || '{}').received || 0}</li>
                    <li><span className="font-bold">Total Value Documented:</span> ₦{Number(JSON.parse(viewingReport.financial_json || '{}').value || 0).toLocaleString()}</li>
                    <li className="pt-2"><span className="font-bold">Payment Methods Used:</span> <br/><span className="uppercase text-slate-700">{JSON.parse(viewingReport.financial_json || '{}').methods || 'N/A'}</span></li>
                    <li className="pt-2"><span className="font-bold text-red-800">Discrepancies/Failed Attempts:</span> <br/><span className="uppercase text-red-700 font-bold">{JSON.parse(viewingReport.financial_json || '{}').discrepancies || 'NONE'}</span></li>
                  </ul>
                </div>
              </div>

              <div className="mb-6 text-slate-900">
                <h3 className="font-bold text-lg border-b border-slate-300 pb-1 mb-3">5. Social Media Engagement</h3>
                <ul className="space-y-1 text-sm">
                  <li><span className="font-bold">How many social media posts:</span> {JSON.parse(viewingReport.social_json || '{}').posts || 0}</li>
                  <li><span className="font-bold">Comments/Public Replies:</span> {JSON.parse(viewingReport.social_json || '{}').replies || 0}</li>
                  <li><span className="font-bold">How many likes and followers:</span> {JSON.parse(viewingReport.social_json || '{}').followers || 0}</li>
                  <li className="pt-2"><span className="font-bold">List platforms:</span> <br/><span className="text-slate-700">{JSON.parse(viewingReport.social_json || '{}').platforms || 'N/A'}</span></li>
                </ul>
              </div>

              <div className="mb-6 bg-slate-100 p-5 border border-slate-300 text-slate-900 rounded-lg">
                <h3 className="font-bold text-lg border-b border-slate-300 pb-2 mb-3">6. Summary & Observations</h3>
                <p className="mb-4"><span className="font-bold block mb-1">Key Highlights:</span> <span className="uppercase text-slate-800 leading-relaxed block">{JSON.parse(viewingReport.summary_json || '{}').highlights || 'N/A'}</span></p>
                <p><span className="font-bold block mb-1">Action Items for Tomorrow:</span> <span className="uppercase text-slate-800 leading-relaxed block">{JSON.parse(viewingReport.summary_json || '{}').action_items || 'N/A'}</span></p>
              </div>

              <div className="mt-16 pt-8 border-t-2 border-slate-800 text-center font-bold text-slate-900">
                <p className="mx-auto w-64 border-b-2 border-slate-800 mb-2"></p>
                <p>Customer Service Representative Signature</p>
              </div>

            </div>
          </div>
        </div>
      )}

    </ModuleLayout>
  );
}