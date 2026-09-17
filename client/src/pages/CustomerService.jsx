import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { Headset, Plus, AlertTriangle, FileText, Printer, Trash2 } from 'lucide-react';

export default function CustomerService() {
  const { tickets, customers, authFetch, refreshSystemData, hasRole, user } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('queries');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [closingTicket, setClosingTicket] = useState(null);
  const [ccReports, setCcReports] = useState([]);
  const [viewingReport, setViewingReport] = useState(null);
  
  const [formData, setFormData] = useState({
    date_received: '', time_received: '', customer_ip: '', customer_name: '', query_type: '',
    location: '', service_type: 'FTTH', description: '', whatsapp_sos_sent: false, assigned_to: '', priority: 'Medium'
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
          <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 md:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 w-full md:w-auto shadow-sm transition"><Plus className="w-4 h-4"/> Log New Query</button>
        )
      }
    >
      {/* TAB: ACTIVE QUERIES */}
      {activeTab === 'queries' && (
        <div className="grid grid-cols-1 gap-4 w-full">
          {tickets.filter(t => t.status !== 'Closed').map(t => (
            <div key={t.id} className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:justify-between gap-4">
              <div className="w-full">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-mono text-xs font-bold text-slate-600">{t.id} • {t.query_type || t.category}</p>
                  {t.priority === 'High' && <span className="bg-red-100 text-red-900 px-2 py-0.5 rounded text-[10px] font-bold">URGENT</span>}
                </div>
                <h3 className="font-bold text-slate-900 text-lg">{t.customer_name}</h3>
                <p className="text-sm text-slate-700 mt-1">{t.description}</p>
              </div>
              <div className="sm:text-right border-t border-slate-200 sm:border-t-0 pt-3 sm:pt-0 mt-1 sm:mt-0 flex flex-row sm:flex-col justify-between items-center sm:items-end w-full sm:w-auto gap-2">
                <span className="bg-amber-100 text-amber-900 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">{t.status}</span>
                <div className="flex flex-row gap-2 mt-0 sm:mt-3 w-full sm:w-auto justify-end">
                  {t.status !== 'Resolved' && t.status !== 'Escalated' && (
                    <button onClick={() => handleEscalate(t.id)} className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold px-4 py-2 rounded-lg text-xs transition flex items-center justify-center gap-1 shadow-sm"><AlertTriangle className="w-3.5 h-3.5"/> Escalate</button>
                  )}
                  {(t.status === 'Resolved' || hasRole(['Management', 'Dev'])) && (
                    <button onClick={() => setClosingTicket(t)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg text-xs transition shadow-sm w-full sm:w-auto">Close Query</button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {tickets.filter(t => t.status !== 'Closed').length === 0 && <p className="text-slate-600 font-medium p-4">No active queries found.</p>}
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

      {/* TAB: REPORT ARCHIVES */}
      {activeTab === 'report-history' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          {ccReports.map(rpt => (
             <div key={rpt.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-emerald-400 transition cursor-pointer" onClick={() => setViewingReport(rpt)}>
               <div>
                 <div className="flex justify-between items-start mb-2">
                   <p className="font-mono text-xs font-bold text-emerald-800">{rpt.report_date}</p>
                   <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-mono font-bold">{rpt.id}</span>
                 </div>
                 <h4 className="font-bold text-slate-900">Rep: {rpt.fullname}</h4>
                 <p className="text-xs text-slate-600 mt-2 truncate">Highlights: {JSON.parse(rpt.summary_json || '{}').highlights || 'N/A'}</p>
               </div>
               <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-bold text-slate-800">
                 <span>Interactions: {JSON.parse(rpt.interaction_log || '[]').length}</span>
                 <button className="text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-100 transition"><FileText className="w-3.5 h-3.5"/> View Document</button>
               </div>
             </div>
          ))}
          {ccReports.length === 0 && <p className="text-slate-600 font-medium p-4 col-span-3">No historical reports found.</p>}
        </div>
      )}

      {/* NEW QUERY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-lg mb-4 border-b border-slate-200 pb-2 text-slate-900">Log Customer Query</h3>
            <form onSubmit={handleCreateTicket} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Customer Name</label><input type="text" required placeholder="Customer Name" onChange={e => setFormData({...formData, customer_name: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Date Received</label><input type="date" required onChange={e => setFormData({...formData, date_received: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900" /></div>
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Time</label><input type="text" placeholder="09:15 AM" onChange={e => setFormData({...formData, time_received: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Customer IP Number</label><input type="text" placeholder="IP Address" onChange={e => setFormData({...formData, customer_ip: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Query Type</label><input type="text" required placeholder="Nature of Query" onChange={e => setFormData({...formData, query_type: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Location</label><input type="text" placeholder="Location" onChange={e => setFormData({...formData, location: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Service Type</label><select onChange={e => setFormData({...formData, service_type: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 font-bold"><option>FTTH</option><option>Enterprise</option></select></div>
              
              <div className="sm:col-span-2 md:col-span-4"><label className="text-[10px] font-bold block mb-1 text-slate-900">Issue Description</label><textarea required placeholder="Detailed Issue Description" onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg h-24 bg-white text-slate-900 placeholder-slate-400" /></div>
              
              <div className="sm:col-span-2 flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-300"><input type="checkbox" onChange={e => setFormData({...formData, whatsapp_sos_sent: e.target.checked})} className="w-5 h-5 sm:w-4 sm:h-4 rounded text-emerald-600"/> <label className="text-[11px] font-bold text-slate-900">WhatsApp SOS Sent</label></div>
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
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
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