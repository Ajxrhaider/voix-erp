import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { Users, Wrench, AlertCircle, CheckSquare, Zap } from 'lucide-react';

export default function NOCDashboard() {
  const { tickets, dailyTeams, workOrders, staff, deployments, inventory, authFetch } = useContext(AppContext);
  
  const [tktCustId, setTktCustId] = useState('');
  const [tktTitle, setTktTitle] = useState('');
  const [tktDesc, setTktDesc] = useState('');
  const [tktType, setTktType] = useState('NOC');

  const [teamLeader, setTeamLeader] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);

  const [woTicketId, setWoTicketId] = useState('');
  const [woDepId, setWoDepId] = useState('');
  const [woTeamId, setWoTeamId] = useState('');
  const [woObj, setWoObj] = useState('');
  const [woMaterials, setWoMaterials] = useState([]);
  
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    await authFetch('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ customerId: tktCustId, title: tktTitle, description: tktDesc, type: tktType })
    });
    setTktTitle(''); setTktDesc('');
  };

  const handleCreateDailyTeam = async (e) => {
    e.preventDefault();
    await authFetch('/api/teams/daily', {
      method: 'POST',
      body: JSON.stringify({ leaderId: teamLeader, members: selectedMembers })
    });
    setTeamLeader(''); setSelectedMembers([]);
  };

  const handleAssignWorkOrder = async (e) => {
    e.preventDefault();
    await authFetch('/api/work-orders', {
      method: 'POST',
      body: JSON.stringify({ ticketId: woTicketId, deploymentId: woDepId, teamId: woTeamId, objective: woObj, assignedMaterials: woMaterials })
    });
    setWoObj(''); setWoMaterials([]);
  };

  const handleCompleteWorkOrder = async (woId) => {
    // In a full implementation, you'd prompt the user for leftover JSON array here. Defaulting to empty array for direct UI action.
    await authFetch(`/api/work-orders/${woId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ leftovers: [] })
    });
  };

  return (
    <div className="space-y-6 text-xs font-sans">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Col 1: Team Formation & Tickets */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 text-[11px] flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-400" /> Dispatch Query / Ticket
            </h3>
            <form onSubmit={handleCreateTicket} className="space-y-2.5">
              <input type="text" placeholder="Customer ID (Optional)" value={tktCustId} onChange={e => setTktCustId(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white font-mono" />
              <input type="text" required placeholder="Issue Title" value={tktTitle} onChange={e => setTktTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white font-medium" />
              <textarea required placeholder="Technical Description" value={tktDesc} onChange={e => setTktDesc(e.target.value)} rows="3" className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white text-[11px]" />
              <select value={tktType} onChange={e => setTktType(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white">
                <option value="NOC">NOC Investigation</option>
                <option value="Fiber">Fiber Optics Field</option>
                <option value="Customer Service">Client Relations</option>
              </select>
              <button type="submit" className="w-full py-2 bg-rose-900/50 hover:bg-rose-800/80 text-rose-300 font-bold rounded uppercase tracking-wider border border-rose-800 transition">Raise Ticket</button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 text-[11px] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-400" /> Structure Daily Field Team
            </h3>
            <form onSubmit={handleCreateDailyTeam} className="space-y-2.5">
              <select required value={teamLeader} onChange={e => setTeamLeader(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white">
                <option value="">Select Team Leader...</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.fullname} ({s.role})</option>)}
              </select>
              <select multiple value={selectedMembers} onChange={e => setSelectedMembers(Array.from(e.target.selectedOptions, option => option.value))} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white h-24">
                {staff.map(s => <option key={s.id} value={s.id}>{s.fullname}</option>)}
              </select>
              <button type="submit" className="w-full py-2 bg-blue-900/50 hover:bg-blue-800/80 text-blue-300 font-bold rounded uppercase tracking-wider border border-blue-800 transition">Deploy Team Unit</button>
            </form>
          </div>
        </div>

        {/* Col 2: Work Order Engine */}
        <div className="xl:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col space-y-4">
          <h3 className="font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 text-[11px] flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" /> Issue Field Work Order
          </h3>
          <form onSubmit={handleAssignWorkOrder} className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <select value={woTicketId} onChange={e => {setWoTicketId(e.target.value); setWoDepId('');}} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white">
                <option value="">Link to Open Ticket (Optional)...</option>
                {tickets.filter(t => t.status !== 'Closed').map(t => <option key={t.id} value={t.id}>{t.id} - {t.title}</option>)}
              </select>
              <select value={woDepId} onChange={e => {setWoDepId(e.target.value); setWoTicketId('');}} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white">
                <option value="">Link to Deployment (Optional)...</option>
                {deployments.filter(d => d.status !== 'Completed').map(d => <option key={d.id} value={d.id}>{d.id} - {d.customer_name}</option>)}
              </select>
              <select required value={woTeamId} onChange={e => setWoTeamId(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white">
                <option value="">Assign to Daily Team...</option>
                {dailyTeams.map(t => <option key={t.id} value={t.id}>{t.id}</option>)}
              </select>
            </div>
            <div className="space-y-3">
              <textarea required placeholder="Mission Objective" value={woObj} onChange={e => setWoObj(e.target.value)} rows="3" className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white" />
              <button type="submit" className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-black rounded uppercase tracking-wider shadow-lg shadow-amber-900/20 transition">Execute Work Order</button>
            </div>
          </form>

          {/* Active Work Orders Grid */}
          <div className="pt-4 border-t border-slate-800 flex-1 overflow-y-auto max-h-80 pr-1 space-y-2">
            {workOrders.map(wo => (
              <div key={wo.id} className="bg-slate-950 border border-slate-850 rounded-lg p-3 flex justify-between items-center hover:border-slate-700 transition">
                <div>
                  <div className="flex gap-2 items-center">
                    <span className="font-mono text-amber-400 font-bold text-[11px]">{wo.id}</span>
                    <span className="text-[9px] bg-slate-900 px-1 border border-slate-800 text-slate-400 rounded">Team: {wo.team_id}</span>
                  </div>
                  <p className="text-white font-medium mt-1 truncate max-w-lg">{wo.objective}</p>
                  <p className="text-slate-500 font-mono text-[9px] mt-0.5">Ref: {wo.ticket_id || wo.deployment_id || 'Direct Mission'}</p>
                </div>
                {wo.status !== 'Completed' ? (
                  <button onClick={() => handleCompleteWorkOrder(wo.id)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded font-bold uppercase tracking-wider text-[10px] flex gap-1 items-center">
                    <CheckSquare className="w-3 h-3" /> Close
                  </button>
                ) : (
                  <span className="px-2 py-1 bg-teal-900/30 text-teal-400 text-[9px] font-bold uppercase rounded border border-teal-800/50">Closed</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}