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
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto custom-scrollbar w-full">
        <table className="w-full text-left text-sm min-w-[1000px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-3 text-slate-900 font-bold whitespace-nowrap">VNQ ID</th>
              <th className="p-3 text-slate-900 font-bold">Date & Time</th>
              <th className="p-3 text-slate-900 font-bold">Customer</th>
              <th className="p-3 text-slate-900 font-bold">Query Type</th>
              <th className="p-3 text-slate-900 font-bold">Location</th>
              <th className="p-3 text-center text-slate-900 font-bold">Status</th>
              <th className="p-3 text-center text-slate-900 font-bold">Priority</th>
              <th className="p-3 text-right text-slate-900 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.filter(t => t.status !== 'Closed').map(t => (
              <tr key={t.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-mono font-bold text-slate-600 whitespace-nowrap">{t.id}</td>
                <td className="p-3">
                  <span className="block font-bold text-slate-900 whitespace-nowrap">{t.date_received}</span>
                  <span className="block text-[10px] text-slate-500 font-mono mt-0.5">{t.time_received || '--:--'}</span>
                </td>
                <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{t.customer_name || 'N/A'}</td>
                <td className="p-3 text-slate-900 font-medium">{t.query_type}</td>
                <td className="p-3 text-xs text-slate-700 min-w-[150px]">{t.location}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${t.status === 'Resolved' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>{t.status}</span>
                </td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap ${t.priority === 'High' ? 'bg-red-100 text-red-900' : 'bg-slate-100 text-slate-800'}`}>{t.priority || 'Medium'}</span>
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    {t.status !== 'Resolved' && t.status !== 'Converted to Work Order' && hasRole(['NOC', 'Management', 'Dev', 'HOD NOC']) && (
                      <>
                        <button onClick={() => { setConvertingTicket(t); setWoData({ team_id: '', objective: t.description, location: t.location }); }} className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded text-[10px] font-bold shadow-sm transition" title="Convert to Work Order">Convert WO</button>
                        <button onClick={() => handleEscalate(t.id)} className="bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 px-2.5 py-1.5 rounded text-[10px] font-bold shadow-sm transition" title="Escalate Ticket">Escalate</button>
                      </>
                    )}
                    {(t.status === 'Resolved' || hasRole(['Management', 'Dev', 'NOC'])) && (
                      <button onClick={() => setClosingTicket(t)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded text-[10px] font-bold shadow-sm transition" title="Close Ticket">Close</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {tickets.filter(t => t.status !== 'Closed').length === 0 && <tr><td colSpan="8" className="p-8 text-center text-slate-600 font-medium">No active tickets.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* NEW QUERY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <h3 className="font-bold text-lg mb-4 border-b border-slate-200 pb-2 text-slate-900">Log Customer Query</h3>
            <form onSubmit={handleCreateTicket} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="sm:col-span-2"><label className="text-[10px] font-bold block mb-1 text-slate-900">Customer Name (Optional)</label><input type="text" placeholder="Customer Name" onChange={e => setFormData({...formData, customer_name: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Date Received</label><input type="date" required value={formData.date_received} onChange={e => setFormData({...formData, date_received: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900" /></div>
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Time Received</label><input type="text" placeholder="e.g. 09:15 AM" onChange={e => setFormData({...formData, time_received: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              
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

      {/* CONVERT TO WO MODAL */}
      {convertingTicket && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
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
                <textarea required value={woData.objective} onChange={e => setWoData({...woData, objective: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 h-20 placeholder-slate-400" placeholder="Dispatch objective..." />
              </div>
              <div>
                <label className="text-[10px] font-bold block mb-1 text-slate-900">Exact Location / Coordinates</label>
                <input type="text" required value={woData.location} onChange={e => setWoData({...woData, location: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400" />
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