import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { Users, FileText, UserPlus, SplitSquareHorizontal } from 'lucide-react';

export default function Fiber() {
  const { teams, staff, workOrders, authFetch, refreshSystemData, hasRole } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('teams');
  const [isTeamModal, setIsTeamModal] = useState(false);
  const [isReportModal, setIsReportModal] = useState(false);
  const [splittingTeam, setSplittingTeam] = useState(null);
  
  const [teamData, setTeamData] = useState({ name: '', leader_id: '', member_ids: [], assigned_vehicle: '' });
  const [reportData, setReportData] = useState({ 
    work_order_id: '', time_arrived: '', splicer_name: '', closure_location_gps: '', 
    failure_point_desc: '', manipulations_made: '', route_segment: '', otdr_distance_meters: '' 
  });

  const fiberStaff = staff.filter(s => (s.roles || []).includes('Fiber') || (s.roles || []).includes('HOD Fiber'));

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    await authFetch('/api/teams/daily', { method: 'POST', body: JSON.stringify(teamData) });
    setIsTeamModal(false);
    refreshSystemData();
  };

  const handleSplitTeam = async (e) => {
    e.preventDefault();
    // 1. Remove selected members from original team
    const originalMembers = JSON.parse(splittingTeam.member_ids || '[]');
    const remainingMembers = originalMembers.filter(id => !teamData.member_ids.includes(id));
    
    await authFetch(`/api/teams/daily/${splittingTeam.id}`, { 
      method: 'PATCH', 
      body: JSON.stringify({ member_ids: remainingMembers }) 
    });

    // 2. Create the new sub-team
    await authFetch('/api/teams/daily', { method: 'POST', body: JSON.stringify(teamData) });
    
    setSplittingTeam(null);
    refreshSystemData();
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    await authFetch('/api/teams/fiber-report', { method: 'POST', body: JSON.stringify(reportData) });
    setIsReportModal(false);
    alert("Fiber Restoration Report formally submitted and logged.");
  };

  return (
    <ModuleLayout
      title="Field Operations"
      subtitle="Dynamic routing teams & Official splicing reports"
      icon={<Users className="w-6 h-6" />}
      tabs={[{ id: 'teams', label: 'Daily Active Teams' }, { id: 'reports', label: 'Fiber Reports' }]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerActions={
        hasRole(['HOD Fiber', 'Management', 'GM', 'Dev']) && (
          <>
            <button onClick={() => {setTeamData({ name: '', leader_id: '', member_ids: [], assigned_vehicle: '' }); setIsTeamModal(true);}} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><UserPlus className="w-4 h-4"/> Mobilize Team</button>
            <button onClick={() => setIsReportModal(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><FileText className="w-4 h-4"/> Submit Report</button>
          </>
        )
      }
    >
      {activeTab === 'teams' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {teams.map(t => (
            <div key={t.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-blue-500">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-slate-900 text-lg">{t.name}</h3>
                {hasRole(['HOD Fiber', 'Management', 'GM']) && (
                  <button onClick={() => {
                    setSplittingTeam(t);
                    setTeamData({ name: `${t.name} (Sub-Team)`, leader_id: '', member_ids: [], assigned_vehicle: '' });
                  }} className="text-slate-400 hover:text-blue-600 transition" title="Split Team">
                    <SplitSquareHorizontal className="w-5 h-5"/>
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono mb-4">{t.id} • {t.assigned_vehicle}</p>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-xs font-bold text-slate-600 uppercase mb-2">Team Roster</p>
                <p className="text-sm font-bold text-blue-700">⭐ {staff.find(s => s.id === t.leader_id)?.fullname || t.leader_id} (Lead)</p>
                <div className="text-sm text-slate-700 mt-2 space-y-1">
                  {JSON.parse(t.member_ids || '[]').map(mId => (
                    <p key={mId}>• {staff.find(s => s.id === mId)?.fullname || mId}</p>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-12 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-500">
          <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="font-semibold text-slate-700">Fiber Restoration Reports Archive</p>
          <p className="text-sm mt-1">Official splicing reports are securely logged in the database per Voix operational guidelines.</p>
        </div>
      )}

      {/* MODALS */}
      {isTeamModal && !splittingTeam && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Mobilize Daily Team</h3>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <input type="text" required placeholder="Team Name" onChange={e => setTeamData({...teamData, name: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" />
              <input type="text" required placeholder="Assigned Vehicle" onChange={e => setTeamData({...teamData, assigned_vehicle: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" />
              <select required onChange={e => setTeamData({...teamData, leader_id: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50 font-bold">
                <option value="">Select Team Leader...</option>
                {fiberStaff.map(s => <option key={s.id} value={s.id}>{s.fullname}</option>)}
              </select>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Select Members (Hold Ctrl/Cmd)</label>
                <select multiple onChange={e => setTeamData({...teamData, member_ids: Array.from(e.target.selectedOptions, option => option.value)})} className="w-full border p-2.5 rounded-lg text-sm bg-white h-32">
                  {fiberStaff.map(s => <option key={s.id} value={s.id}>{s.fullname}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsTeamModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Mobilize</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {splittingTeam && (
         <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
         <div className="bg-white rounded-xl p-6 w-full max-w-md">
           <h3 className="font-bold text-lg mb-2">Split Team: {splittingTeam.name}</h3>
           <p className="text-xs text-slate-500 mb-4">Select members to detach and form a new temporary sub-team.</p>
           <form onSubmit={handleSplitTeam} className="space-y-4">
             <input type="text" required placeholder="New Sub-Team Name" value={teamData.name} onChange={e => setTeamData({...teamData, name: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" />
             <input type="text" required placeholder="Assigned Vehicle / Transport" onChange={e => setTeamData({...teamData, assigned_vehicle: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" />
             
             <div>
               <label className="text-xs font-bold text-slate-600 block mb-1">Members to Detach (Hold Ctrl/Cmd)</label>
               <select multiple required onChange={e => setTeamData({...teamData, member_ids: Array.from(e.target.selectedOptions, option => option.value)})} className="w-full border p-2.5 rounded-lg text-sm bg-white h-24">
                 {JSON.parse(splittingTeam.member_ids || '[]').map(mId => (
                   <option key={mId} value={mId}>{staff.find(s => s.id === mId)?.fullname || mId}</option>
                 ))}
               </select>
             </div>
             
             <select required onChange={e => setTeamData({...teamData, leader_id: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50 font-bold">
               <option value="">Promote Sub-Team Leader...</option>
               {teamData.member_ids.map(mId => <option key={mId} value={mId}>{staff.find(s => s.id === mId)?.fullname || mId}</option>)}
             </select>

             <div className="flex justify-end gap-2 pt-2">
               <button type="button" onClick={() => setSplittingTeam(null)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
               <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Split & Mobilize</button>
             </div>
           </form>
         </div>
       </div>
      )}

      {/* REPORT MODAL (Kept exact .docx structure) */}
      {isReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-xl border-b border-slate-200 pb-3 mb-5">Daily Fiber Restoration & Splicing Report</h3>
            <form onSubmit={handleSubmitReport} className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* ... (Existing Report Fields remain unchanged to preserve .docx structure) ... */}
               <select required onChange={e => setReportData({...reportData, work_order_id: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50 col-span-2">
                  <option value="">Select Work Order...</option>
                  {workOrders.filter(w => w.status !== 'Closed').map(w => <option key={w.id} value={w.id}>{w.id} - {w.objective}</option>)}
                </select>
                <div><input type="text" required placeholder="Time Arrived" onChange={e => setReportData({...reportData, time_arrived: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" /></div>
                <div><input type="text" required placeholder="Splicer Responsible" onChange={e => setReportData({...reportData, splicer_name: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" /></div>
                <div className="col-span-2"><input type="text" required placeholder="Closure Location & GPS" onChange={e => setReportData({...reportData, closure_location_gps: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" /></div>
                <div className="col-span-2"><input type="text" required placeholder="Failure Point Description" onChange={e => setReportData({...reportData, failure_point_desc: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" /></div>
                <div className="col-span-2"><textarea required placeholder="Manipulations Made" onChange={e => setReportData({...reportData, manipulations_made: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50 h-20" /></div>
                <div><input type="text" required placeholder="Route Segment" onChange={e => setReportData({...reportData, route_segment: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" /></div>
                <div><input type="number" required placeholder="OTDR Distance (m)" onChange={e => setReportData({...reportData, otdr_distance_meters: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50 font-mono" /></div>
              <div className="col-span-2 flex justify-end gap-3 pt-5 border-t mt-2">
                <button type="button" onClick={() => setIsReportModal(false)} className="px-5 py-2.5 border rounded-lg text-sm font-bold text-slate-600">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}