import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { AlertCircle, Plus, Wrench, CheckSquare, AlertTriangle } from 'lucide-react';

export default function Tickets() {
  const { tickets, teams, authFetch, refreshSystemData, hasRole, user } = useContext(AppContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [closingTicket, setClosingTicket] = useState(null);
  const [convertingTicket, setConvertingTicket] = useState(null);

  const [formData, setFormData] = useState({
    date_received: new Date().toISOString().split('T')[0], time_received: '', 
    customer_ip: '', customer_name: '', query_type: '', location: '', 
    service_type: 'FTTH', description: '', whatsapp_sos_sent: false, assigned_to: '', priority: 'Medium'
  });

  const [woData, setWoData] = useState({ team_id: '', objective: '', location: '' });

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

  const handleConvertToWO = async (e) => {
    e.preventDefault();
    await authFetch(`/api/tickets/${convertingTicket.id}/convert-to-work-order`, { method: 'POST', body: JSON.stringify(woData) });
    setConvertingTicket(null);
    refreshSystemData();
  };

  return (
    <ModuleLayout
      title="NOC Support Desk"
      subtitle="Manage network alerts, detailed queries, and field dispatches"
      icon={<AlertCircle className="w-6 h-6" />}
      headerActions={hasRole(['NOC', 'Management', 'GM', 'Dev', 'Customer Service']) && (
        <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm transition"><Plus className="w-4 h-4"/> Log New Query</button>
      )}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
        {tickets.filter(t => t.status !== 'Closed').map(t => (
          <div key={t.id} className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between transition hover:shadow-md">
            <div>
              <div className="flex justify-between items-start mb-2 gap-2">
                <p className="font-mono text-[11px] sm:text-xs font-bold text-slate-500">{t.id} • {t.query_type}</p>
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
              {t.status !== 'Resolved' && t.status !== 'Converted to Work Order' && hasRole(['NOC', 'Management', 'Dev', 'HOD NOC']) && (
                <>
                  <button onClick={() => { setConvertingTicket(t); setWoData({ team_id: '', objective: t.description, location: t.location }); }} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2.5 sm:py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 w-full shadow-sm"><Wrench className="w-3.5 h-3.5"/> Convert to WO</button>
                  <button onClick={() => handleEscalate(t.id)} className="bg-slate-200 hover:bg-slate-300 text-slate-900 px-3 py-2.5 sm:py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 w-full shadow-sm"><AlertTriangle className="w-3.5 h-3.5"/> Escalate</button>
                </>
              )}
              {(t.status === 'Resolved' || hasRole(['Management', 'Dev', 'NOC'])) && (
                <button onClick={() => setClosingTicket(t)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2.5 sm:py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 w-full shadow-sm"><CheckSquare className="w-3.5 h-3.5"/> Close Ticket</button>
              )}
            </div>
          </div>
        ))}
        {tickets.filter(t => t.status !== 'Closed').length === 0 && <p className="text-slate-600 font-medium p-4 col-span-2">No active tickets.</p>}
      </div>

      {/* NEW QUERY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-lg mb-4 border-b border-slate-200 pb-2 text-slate-900">Log Customer Query</h3>
            <form onSubmit={handleCreateTicket} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Customer Name</label><input type="text" required placeholder="Customer Name" onChange={e => setFormData({...formData, customer_name: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder:text-slate-500" /></div>
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Date Received</label><input type="date" required value={formData.date_received} onChange={e => setFormData({...formData, date_received: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900" /></div>
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Time</label><input type="text" placeholder="e.g. 09:15 AM" onChange={e => setFormData({...formData, time_received: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder:text-slate-500" /></div>
              
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Customer IP Number</label><input type="text" placeholder="IP Address" onChange={e => setFormData({...formData, customer_ip: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder:text-slate-500" /></div>
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Query Type</label><input type="text" required placeholder="Nature of Query" onChange={e => setFormData({...formData, query_type: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder:text-slate-500" /></div>
              
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Location</label><input type="text" placeholder="Location" onChange={e => setFormData({...formData, location: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder:text-slate-500" /></div>
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Service Type</label><select value={formData.service_type} onChange={e => setFormData({...formData, service_type: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 font-bold"><option>FTTH</option><option>Enterprise</option></select></div>
              
              <div className="sm:col-span-2 md:col-span-4"><label className="text-[10px] font-bold block mb-1 text-slate-900">Issue Description</label><textarea required placeholder="Detailed Issue Description" onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg h-24 bg-white text-slate-900 placeholder:text-slate-500" /></div>
              
              <div className="sm:col-span-2 flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-300"><input type="checkbox" checked={formData.whatsapp_sos_sent} onChange={e => setFormData({...formData, whatsapp_sos_sent: e.target.checked})} className="w-5 h-5 sm:w-4 sm:h-4 rounded text-emerald-600 border-slate-400"/> <label className="text-[11px] font-bold text-slate-900">WhatsApp SOS Sent</label></div>
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Assigned To (Internal Team)</label><input type="text" placeholder="Assigned To (Fiber/NOC Team)" onChange={e => setFormData({...formData, assigned_to: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder:text-slate-500" /></div>
              
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
              
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Mean Time to Resolve (MTTR)</label><input type="text" placeholder="e.g. 2 Hours" onChange={e => setClosingTicket({...closingTicket, mttr: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder:text-slate-500" /></div>
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Resolved By (Tech Name)</label><input type="text" placeholder="Technician Name" onChange={e => setClosingTicket({...closingTicket, resolution_by: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder:text-slate-500" /></div>
              
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Customer Feedback</label><textarea placeholder="Customer Feedback / Notes" onChange={e => setClosingTicket({...closingTicket, customer_feedback: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-slate-900 h-20 placeholder:text-slate-500" /></div>
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Official Closure Notes</label><textarea required placeholder="Detailed Closure Notes" onChange={e => setClosingTicket({...closingTicket, closure_notes: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-slate-900 h-20 placeholder:text-slate-500" /></div>
              
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Ticket Closed By</label><input type="text" value={user?.fullname || 'System'} readOnly className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-200 text-slate-700 font-bold" /></div>
              
              <div className="sm:col-span-2 flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200 mt-2">
                <button type="button" onClick={() => setClosingTicket(null)} className="px-4 py-2.5 sm:py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg text-sm w-full sm:w-auto transition shadow-sm">Cancel</button>
                <button type="submit" className="px-4 py-2.5 sm:py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-sm shadow-sm w-full sm:w-auto transition">Formally Close Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONVERT TO WO MODAL */}
      {convertingTicket && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-lg mb-4 border-b border-slate-200 pb-2 text-slate-900">Dispatch Work Order for {convertingTicket.id}</h3>
            <form onSubmit={handleConvertToWO} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold block mb-1 text-slate-900">Assign to Field Team</label>
                <select required onChange={e => setWoData({...woData, team_id: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 font-bold">
                  <option value="">Select Team...</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold block mb-1 text-slate-900">Work Order Objective</label>
                <textarea required value={woData.objective} onChange={e => setWoData({...woData, objective: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 h-20 placeholder:text-slate-400" placeholder="Dispatch objective..." />
              </div>
              <div>
                <label className="text-[10px] font-bold block mb-1 text-slate-900">Exact Location / Coordinates</label>
                <input type="text" required value={woData.location} onChange={e => setWoData({...woData, location: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder:text-slate-400" />
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200 mt-2">
                <button type="button" onClick={() => setConvertingTicket(null)} className="px-4 py-2.5 sm:py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg text-sm w-full sm:w-auto transition shadow-sm">Cancel</button>
                <button type="submit" className="px-4 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm shadow-sm w-full sm:w-auto transition">Dispatch Team</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}