import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { Users, FileText } from 'lucide-react';

export default function Fiber() {
  const { teams, staff, workOrders, authFetch, refreshSystemData, user } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('teams');
  const [isTeamModal, setIsTeamModal] = useState(false);
  const [isReportModal, setIsReportModal] = useState(false);
  
  const [teamData, setTeamData] = useState({ name: '', leader_id: '', member_ids: [], assigned_vehicle: '' });
  const [reportData, setReportData] = useState({ work_order_id: '', time_arrived: '', splicer_name: '', closure_location_gps: '', failure_point_desc: '', manipulations_made: '', route_segment: '', otdr_distance_meters: '' });

  const fiberStaff = staff.filter(s => s.role === 'Fiber');

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    await authFetch('/api/teams/daily', { method: 'POST', body: JSON.stringify(teamData) });
    setIsTeamModal(false);
    refreshSystemData();
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    await authFetch('/api/teams/fiber-report', { method: 'POST', body: JSON.stringify(reportData) });
    setIsReportModal(false);
    alert("Fiber Restoration Report submitted successfully.");
  };

  return (
    <ModuleLayout
      title="Field Operations"
      subtitle="Daily flexible teams & Splicing reports"
      icon={<Users className="w-6 h-6" />}
      tabs={[{ id: 'teams', label: 'Daily Active Teams' }, { id: 'reports', label: 'Fiber Reports' }]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerActions={
        <>
          <button onClick={() => setIsTeamModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex gap-2"><Users className="w-4 h-4"/> Mobilize Team</button>
          <button onClick={() => setIsReportModal(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex gap-2"><FileText className="w-4 h-4"/> Submit Report</button>
        </>
      }
    >
      {activeTab === 'teams' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {teams.map(t => (
            <div key={t.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-blue-500">
              <h3 className="font-bold text-slate-900 text-lg">{t.name}</h3>
              <p className="text-xs text-slate-500 font-mono mb-4">{t.id} • {t.assigned_vehicle}</p>
              <div className="bg-slate-50 p-3 rounded-lg border">
                <p className="text-xs font-bold text-slate-600 uppercase mb-2">Team Roster</p>
                <p className="text-sm font-bold text-blue-700">⭐ {staff.find(s => s.id === t.leader_id)?.fullname || t.leader_id} (Lead)</p>
                <div className="text-sm text-slate-700 mt-2">
                  {JSON.parse(t.member_ids || '[]').map(mId => (
                    <p key={mId}>• {staff.find(s => s.id === mId)?.fullname || mId}</p>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {teams.length === 0 && <p className="text-slate-500 p-4">No field teams mobilized for today.</p>}
        </div>
      ) : (
        <div className="bg-white p-12 text-center border-2 border-dashed rounded-xl text-slate-500">
          <FileText className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <p>Fiber Restoration Reports are securely logged in the database.</p>
        </div>
      )}

      {/* TEAM MODAL */}
      {isTeamModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Mobilize Daily Team</h3>
            <form onSubmit={handleCreateTeam} className="space-y-3">
              <input type="text" required placeholder="Team Name (e.g. Wuse Alpha Team)" onChange={e => setTeamData({...teamData, name: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <input type="text" required placeholder="Assigned Vehicle" onChange={e => setTeamData({...teamData, assigned_vehicle: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <select required onChange={e => setTeamData({...teamData, leader_id: e.target.value})} className="w-full border p-2 rounded text-sm bg-white">
                <option value="">Select Team Leader...</option>
                {fiberStaff.map(s => <option key={s.id} value={s.id}>{s.fullname}</option>)}
              </select>
              <div>
                <label className="text-xs font-bold text-slate-600">Select Members (Hold Ctrl/Cmd)</label>
                <select multiple onChange={e => setTeamData({...teamData, member_ids: Array.from(e.target.selectedOptions, option => option.value)})} className="w-full border p-2 rounded text-sm bg-white h-24">
                  {fiberStaff.map(s => <option key={s.id} value={s.id}>{s.fullname}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsTeamModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Mobilize</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPORT MODAL (Matches .docx structure exactly) */}
      {isReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg border-b pb-2 mb-4">Daily Fiber Restoration & Splicing Report</h3>
            <form onSubmit={handleSubmitReport} className="grid grid-cols-2 gap-4">
              <select required onChange={e => setReportData({...reportData, work_order_id: e.target.value})} className="w-full border p-2 rounded text-sm col-span-2">
                <option value="">Select Assocaited Work Order...</option>
                {workOrders.filter(w => w.status !== 'Closed').map(w => <option key={w.id} value={w.id}>{w.id} - {w.objective}</option>)}
              </select>
              <input type="text" required placeholder="Time Arrived (e.g. 08:45 AM)" onChange={e => setReportData({...reportData, time_arrived: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <input type="text" required placeholder="Splicer Responsible (Name)" onChange={e => setReportData({...reportData, splicer_name: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <input type="text" required placeholder="Closure Location & GPS / Manhole ID" onChange={e => setReportData({...reportData, closure_location_gps: e.target.value})} className="w-full border p-2 rounded text-sm col-span-2" />
              <input type="text" required placeholder="Failure Point Description (e.g. High Loss Core 4)" onChange={e => setReportData({...reportData, failure_point_desc: e.target.value})} className="w-full border p-2 rounded text-sm col-span-2" />
              <input type="text" required placeholder="Manipulations & Changes Made (Be Exact)" onChange={e => setReportData({...reportData, manipulations_made: e.target.value})} className="w-full border p-2 rounded text-sm col-span-2" />
              <input type="text" required placeholder="Route Segment (e.g. Node A to Hub)" onChange={e => setReportData({...reportData, route_segment: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <input type="number" required placeholder="OTDR Distance to Cut (Meters)" onChange={e => setReportData({...reportData, otdr_distance_meters: e.target.value})} className="w-full border p-2 rounded text-sm" />
              
              <div className="col-span-2 flex justify-end gap-2 pt-4 border-t mt-2">
                <button type="button" onClick={() => setIsReportModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded font-bold">Submit Official Report</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}