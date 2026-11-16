import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { Users, FileText, UserPlus, SplitSquareHorizontal } from 'lucide-react';

const blankReportData = () => ({
  work_order_id: '', report_date: new Date().toISOString().split('T')[0], vehicle_route: '', ticket_no: '',
  time_arrived: '', splicer_name: '', closure_location_gps: '', failure_point_desc: '',
  manipulations_made: '', route_segment: '', otdr_distance_meters: '', leftover_materials: []
});

export default function Fiber() {
  const { teams, staff, workOrders, inventory, authFetch, refreshSystemData, hasRole, user } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('teams');
  const [isTeamModal, setIsTeamModal] = useState(false);
  const [isReportModal, setIsReportModal] = useState(false);
  const [splittingTeam, setSplittingTeam] = useState(null);
  const [fiberReports, setFiberReports] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedLeftoverItem, setSelectedLeftoverItem] = useState('');
  const [selectedLeftoverQty, setSelectedLeftoverQty] = useState('');
  
  const [teamData, setTeamData] = useState({ name: '', leader_id: '', member_ids: [], assigned_vehicle: '' });
  const [reportData, setReportData] = useState(blankReportData);

  const fiberStaff = staff.filter(s => (s.roles || []).includes('Fiber') || (s.roles || []).includes('HOD Fiber'));
  const selectedReportWorkOrder = workOrders.find(order => order.id === reportData.work_order_id);
  let assignedMaterialIds = new Set();
  try {
    assignedMaterialIds = new Set(JSON.parse(selectedReportWorkOrder?.assigned_materials || '[]').map(item => item.itemId).filter(Boolean));
  } catch {
    assignedMaterialIds = new Set();
  }
  const issuedInventoryItems = inventory.filter(item => assignedMaterialIds.has(item.id));

  useEffect(() => {
    if (activeTab !== 'reports') return undefined;
    let cancelled = false;
    authFetch('/api/teams/fiber-reports')
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || 'Could not load fiber reports.');
        return Array.isArray(body) ? body : [];
      })
      .then(reports => { if (!cancelled) setFiberReports(reports); })
      .catch(error => { if (!cancelled) setErrorMessage(error.message || 'Could not load fiber reports.'); });
    return () => { cancelled = true; };
  }, [activeTab, authFetch]);

  const readResponse = async (response, fallback) => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || fallback);
    return body;
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    const cleanMembers = teamData.member_ids.filter(id => id !== teamData.leader_id);
    try {
      const response = await authFetch('/api/teams/daily', {
        method: 'POST',
        body: JSON.stringify({ ...teamData, member_ids: cleanMembers })
      });
      await readResponse(response, 'Field team could not be mobilized.');
      setIsTeamModal(false);
      await refreshSystemData();
    } catch (error) {
      setErrorMessage(error.message || 'Field team could not be mobilized.');
    }
  };

  const handleSplitTeam = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    const cleanSubTeamMembers = teamData.member_ids.filter(id => id !== teamData.leader_id);
    try {
      const response = await authFetch(`/api/teams/daily/${encodeURIComponent(splittingTeam.id)}/split`, {
        method: 'POST',
        body: JSON.stringify({
          detach_member_ids: teamData.member_ids,
          new_team: { ...teamData, member_ids: cleanSubTeamMembers }
        })
      });
      await readResponse(response, 'The field team could not be split.');
      setSplittingTeam(null);
      await refreshSystemData();
    } catch (error) {
      setErrorMessage(error.message || 'The field team could not be split.');
    }
  };

  const addReportLeftover = () => {
    const inventoryItem = inventory.find(item => item.id === selectedLeftoverItem);
    const quantity = Number(selectedLeftoverQty);
    if (!inventoryItem || !Number.isInteger(quantity) || quantity < 1) {
      setErrorMessage('Select an issued inventory item and enter a positive whole-number quantity.');
      return;
    }

    const assignedMaterials = workOrders.find(order => order.id === reportData.work_order_id)?.assigned_materials || '[]';
    let issuedQuantity = 0;
    try {
      issuedQuantity = JSON.parse(assignedMaterials)
        .filter(item => item.itemId === inventoryItem.id)
        .reduce((total, item) => total + Number(item.qty || 0), 0);
    } catch {
      setErrorMessage('The linked work order has invalid issued-material data.');
      return;
    }
    const alreadyListed = reportData.leftover_materials
      .filter(item => item.itemId === inventoryItem.id)
      .reduce((total, item) => total + Number(item.qty || 0), 0);
    if (quantity + alreadyListed > issuedQuantity) {
      setErrorMessage(`Only ${Math.max(0, issuedQuantity - alreadyListed)} ${inventoryItem.item_name} unit(s) were issued to this work order.`);
      return;
    }

    setReportData(current => ({
      ...current,
      leftover_materials: [...current.leftover_materials, {
        itemId: inventoryItem.id,
        itemName: inventoryItem.item_name,
        qty: quantity
      }]
    }));
    setSelectedLeftoverItem('');
    setSelectedLeftoverQty('');
    setErrorMessage('');
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      const response = await authFetch('/api/teams/fiber-report', {
        method: 'POST',
        body: JSON.stringify({ ...reportData, return_to_inventory: true })
      });
      await readResponse(response, 'The fiber report could not be submitted.');
      setIsReportModal(false);
      setReportData(blankReportData());
      setSelectedLeftoverItem('');
      setSelectedLeftoverQty('');
      await refreshSystemData();
      if (activeTab === 'reports') {
        const reportsResponse = await authFetch('/api/teams/fiber-reports');
        const reportsBody = await readResponse(reportsResponse, 'The report was submitted, but the archive could not be refreshed.');
        setFiberReports(Array.isArray(reportsBody) ? reportsBody : []);
      }
    } catch (error) {
      setErrorMessage(error.message || 'The fiber report could not be submitted.');
    }
  };

  return (
    <ModuleLayout
      title="Field Operations"
      subtitle="Dynamic routing teams & Official splicing reports"
      icon={<Users className="w-6 h-6" />}
      tabs={[{ id: 'teams', label: 'Daily Active Teams' }, { id: 'reports', label: 'Fiber Reports' }]}
      activeTab={activeTab}
      onTabChange={(tab) => { setActiveTab(tab); setErrorMessage(''); }}
      headerActions={hasRole(['HOD Fiber', 'Management', 'GM', 'Dev']) && (
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button onClick={() => {setErrorMessage(''); setTeamData({ name: '', leader_id: '', member_ids: [], assigned_vehicle: '' }); setIsTeamModal(true);}} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm transition"><UserPlus className="w-4 h-4"/> Mobilize Team</button>
          <button onClick={() => { setErrorMessage(''); setReportData(blankReportData()); setSelectedLeftoverItem(''); setSelectedLeftoverQty(''); setIsReportModal(true); }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm transition"><FileText className="w-4 h-4"/> Submit Report</button>
        </div>
      )}
    >
      {errorMessage && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{errorMessage}</div>}
      {activeTab === 'teams' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
          {teams.map(t => (
            <div key={t.id} className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-blue-500 relative flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-900 text-lg">{t.name}</h3>
                  {hasRole(['HOD Fiber', 'Management', 'GM', 'Dev']) && (
                    <button onClick={() => { setSplittingTeam(t); setTeamData({ name: `${t.name} (Sub)`, leader_id: '', member_ids: [], assigned_vehicle: '' }); }} className="text-slate-500 hover:text-blue-700 transition p-1.5 bg-slate-100 hover:bg-blue-50 rounded" title="Split Team"><SplitSquareHorizontal className="w-5 h-5"/></button>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 font-mono mb-4">{t.id} • {t.assigned_vehicle}</p>
                <div className="bg-slate-50 p-3 sm:p-4 rounded-lg border border-slate-200">
                  <p className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase mb-2">Team Roster</p>
                  <p className="text-sm font-bold text-blue-700">⭐ {staff.find(s => s.id === t.leader_id)?.fullname || t.leader_id} (Lead)</p>
                  <div className="text-xs sm:text-sm text-slate-700 mt-2 space-y-1">
                    {JSON.parse(t.member_ids || '[]').map(mId => <p key={mId}>• {staff.find(s => s.id === mId)?.fullname || mId}</p>)}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {teams.length === 0 && <p className="text-slate-600 font-medium p-4">No field teams mobilized for today.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {fiberReports.map((report) => (
            <article key={report.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-slate-900">{report.work_order_id || report.ticket_no || report.id}</h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">{report.report_date}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-emerald-800">{report.splicer_name} · {report.vehicle_route}</p>
              <p className="mt-2 text-sm text-slate-700">{report.failure_point_desc}</p>
              <p className="mt-1 text-xs text-slate-600">{report.closure_location_gps} · {Number(report.otdr_distance_meters || 0).toLocaleString()} m OTDR</p>
              <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{report.manipulations_made}</p>
            </article>
          ))}
          {fiberReports.length === 0 && (
            <div className="bg-white p-6 sm:p-12 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-500 w-full">
              <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-slate-700">No fiber restoration reports have been submitted yet.</p>
              <p className="text-xs sm:text-sm mt-1">Submitted reports will be archived here.</p>
            </div>
          )}
        </div>
      )}

      {/* TEAM CREATION MODAL */}
      {isTeamModal && !splittingTeam && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-lg mb-4 border-b border-slate-200 pb-2 text-slate-900">Mobilize Daily Team</h3>
            {errorMessage && <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{errorMessage}</div>}
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 block mb-1">Team Name</label>
                <input type="text" required placeholder="Team Name (e.g. Wuse Alpha Team)" onChange={e => setTeamData({...teamData, name: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-500" />
              </div>
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 block mb-1">Assigned Vehicle</label>
                <input type="text" required placeholder="Assigned Vehicle" onChange={e => setTeamData({...teamData, assigned_vehicle: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-500" />
              </div>
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 block mb-1">Team Leader</label>
                <select required onChange={e => setTeamData({...teamData, leader_id: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 font-bold">
                  <option value="">Select Appointed Team Leader...</option>
                  {fiberStaff.map(s => <option key={s.id} value={s.id}>{s.fullname}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 block mb-1">Select Splicers & Engineers</label>
                <p className="text-[9px] text-slate-500 mb-1 leading-tight">Hold Ctrl (Windows) or Cmd (Mac) to select multiple members.</p>
                <select multiple onChange={e => setTeamData({...teamData, member_ids: Array.from(e.target.selectedOptions, option => option.value)})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 h-32">
                  {fiberStaff.map(s => <option key={s.id} value={s.id}>{s.fullname}</option>)}
                </select>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200 mt-2">
                <button type="button" onClick={() => setIsTeamModal(false)} className="px-4 py-2.5 sm:py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg text-sm w-full sm:w-auto transition shadow-sm">Cancel</button>
                <button type="submit" className="px-4 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-sm w-full sm:w-auto transition">Mobilize Team</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEAM SPLITTING MODAL */}
      {splittingTeam && (
         <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
         <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
           <h3 className="font-bold text-lg mb-2 border-b border-slate-200 pb-2 text-slate-900">Split Team: {splittingTeam.name}</h3>
           {errorMessage && <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{errorMessage}</div>}
           <p className="text-[11px] sm:text-xs text-slate-600 mb-4 font-medium">Select members to detach and form a new temporary sub-team.</p>
           <form onSubmit={handleSplitTeam} className="space-y-4">
             <div>
               <label className="text-[10px] sm:text-xs font-bold text-slate-900 block mb-1">New Sub-Team Name</label>
               <input type="text" required placeholder="New Sub-Team Name" value={teamData.name} onChange={e => setTeamData({...teamData, name: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-500" />
             </div>
             <div>
               <label className="text-[10px] sm:text-xs font-bold text-slate-900 block mb-1">Assigned Vehicle</label>
               <input type="text" required placeholder="Assigned Vehicle / Transport" onChange={e => setTeamData({...teamData, assigned_vehicle: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-500" />
             </div>
             
             <div>
               <label className="text-[10px] sm:text-xs font-bold text-slate-900 block mb-1">Members to Detach</label>
               <p className="text-[9px] text-slate-500 mb-1 leading-tight">Hold Ctrl (Windows) or Cmd (Mac) to select multiple members.</p>
               <select multiple required onChange={e => setTeamData({...teamData, member_ids: Array.from(e.target.selectedOptions, option => option.value)})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 h-24">
                 {JSON.parse(splittingTeam.member_ids || '[]').map(mId => (
                   <option key={mId} value={mId}>{staff.find(s => s.id === mId)?.fullname || mId}</option>
                 ))}
               </select>
             </div>
             
             <div>
               <label className="text-[10px] sm:text-xs font-bold text-slate-900 block mb-1">Sub-Team Leader</label>
               <select required onChange={e => setTeamData({...teamData, leader_id: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 font-bold">
                 <option value="">Promote Sub-Team Leader...</option>
                 {teamData.member_ids.map(mId => <option key={mId} value={mId}>{staff.find(s => s.id === mId)?.fullname || mId}</option>)}
               </select>
             </div>

             <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200 mt-2">
               <button type="button" onClick={() => setSplittingTeam(null)} className="px-4 py-2.5 sm:py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg text-sm w-full sm:w-auto transition shadow-sm">Cancel</button>
               <button type="submit" className="px-4 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-sm w-full sm:w-auto transition">Split & Mobilize</button>
             </div>
           </form>
         </div>
       </div>
      )}

      {/* OFFICIAL FIBER REPORT MODAL */}
      {isReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-lg sm:text-xl border-b border-slate-200 pb-3 mb-4 sm:mb-5 text-slate-900">Daily Fiber Restoration & Splicing Report</h3>
            {errorMessage && <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{errorMessage}</div>}
            <form onSubmit={handleSubmitReport} className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              
              <div className="sm:col-span-2">
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 mb-1 block">Associated Work Order</label>
                <select required value={reportData.work_order_id} onChange={e => {
                  const wo = workOrders.find(w => w.id === e.target.value);
                  setReportData({ ...reportData, work_order_id: e.target.value, ticket_no: wo?.ticket_id || '', leftover_materials: [] });
                  setSelectedLeftoverItem('');
                  setSelectedLeftoverQty('');
                }} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 font-bold">
                  <option value="">Select Work Order...</option>
                  {workOrders.filter(w => w.status !== 'Closed').map(w => <option key={w.id} value={w.id}>{w.id} - {w.objective}{w.status === 'Fulfilled' ? ' (already fulfilled; report only)' : ''}</option>)}
                </select>
                {selectedReportWorkOrder?.status === 'Fulfilled' && <p className="mt-1 text-[11px] text-amber-800">This work order is already fulfilled. The report will be attached without changing inventory stock again.</p>}
              </div>

              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 mb-1 block">Report Date</label>
                <input type="date" required value={reportData.report_date} onChange={e => setReportData({...reportData, report_date: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900" />
              </div>
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 mb-1 block">Team Lead</label>
                <input type="text" readOnly value={user?.fullname || 'System User'} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-200 text-slate-600 font-bold" />
              </div>
              
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 mb-1 block">Assigned Vehicle/Route</label>
                <input type="text" required placeholder="e.g. Route A / Hilux 2" onChange={e => setReportData({...reportData, vehicle_route: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-500" />
              </div>
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 mb-1 block">Restoration Ticket No.</label>
                <input type="text" required placeholder="Ticket No" value={reportData.ticket_no} onChange={e => setReportData({...reportData, ticket_no: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 font-bold placeholder-slate-500" />
              </div>
              
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 mb-1 block">Time Arrived</label>
                <input type="text" required placeholder="e.g. 08:45 AM" onChange={e => setReportData({...reportData, time_arrived: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-500" />
              </div>
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 mb-1 block">Splicer Responsible</label>
                <input type="text" required placeholder="Exact Technician Name" onChange={e => setReportData({...reportData, splicer_name: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-500" />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 mb-1 block">Closure Location & GPS / Identifier</label>
                <input type="text" required placeholder="e.g. Manhole 12, Wuse Zone 5" onChange={e => setReportData({...reportData, closure_location_gps: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-500" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 mb-1 block">Failure Point Description</label>
                <input type="text" required placeholder="e.g. Total fiber cut / High loss on Core 4" onChange={e => setReportData({...reportData, failure_point_desc: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-500" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 mb-1 block">Manipulations & Changes Made</label>
                <textarea required placeholder="e.g. Spliced cores 1-12; replaced damaged tray..." onChange={e => setReportData({...reportData, manipulations_made: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900 h-20 placeholder-slate-500" />
              </div>

              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 mb-1 block">Route Segment</label>
                <input type="text" required placeholder="e.g. Node A to Wuse Hub" onChange={e => setReportData({...reportData, route_segment: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-500" />
              </div>
              <div>
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 mb-1 block">OTDR Distance to Cut (m)</label>
                <input type="number" required placeholder="1452" onChange={e => setReportData({...reportData, otdr_distance_meters: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 font-mono placeholder-slate-500" />
              </div>

              <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label className="text-[10px] sm:text-xs font-bold text-slate-900 mb-1 block">Leftover issued materials (optional)</label>
                <p className="mb-2 text-[11px] text-slate-600">Choose materials issued to this work order so returned quantities can be reconciled against inventory.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select value={selectedLeftoverItem} onChange={e => setSelectedLeftoverItem(e.target.value)} className="min-w-0 flex-1 border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900">
                    <option value="">Select an issued item...</option>
                    {issuedInventoryItems.map(item => <option key={item.id} value={item.id}>{item.item_name}</option>)}
                  </select>
                  <input type="number" min="1" step="1" value={selectedLeftoverQty} onChange={e => setSelectedLeftoverQty(e.target.value)} placeholder="Qty" className="w-full sm:w-24 border border-slate-300 p-2.5 rounded-lg text-sm bg-white text-slate-900" />
                </div>
                <button type="button" onClick={addReportLeftover} disabled={!selectedReportWorkOrder} className="mt-2 w-full rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">Add leftover</button>
                {reportData.leftover_materials.length > 0 && (
                  <ul className="mt-3 space-y-1 rounded-lg border border-slate-200 bg-white p-2">
                    {reportData.leftover_materials.map((item, index) => (
                      <li key={`${item.itemId}-${index}`} className="flex items-center justify-between gap-2 py-1 text-xs">
                        <span className="font-semibold text-slate-800">{item.itemName} <span className="font-mono text-blue-800">×{item.qty}</span></span>
                        <button type="button" aria-label={`Remove ${item.itemName}`} onClick={() => setReportData(current => ({ ...current, leftover_materials: current.leftover_materials.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded bg-rose-50 px-2 py-1 font-bold text-rose-700 hover:bg-rose-100">Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
                {selectedReportWorkOrder && issuedInventoryItems.length === 0 && <p className="mt-2 text-[11px] text-slate-500">No inventory materials are linked to this work order.</p>}
              </div>
              
              <div className="sm:col-span-2 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 sm:pt-5 border-t border-slate-200 mt-2">
                <button type="button" onClick={() => setIsReportModal(false)} className="px-5 py-2.5 sm:py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg text-sm w-full sm:w-auto transition shadow-sm">Cancel</button>
                <button type="submit" className="px-5 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm w-full sm:w-auto transition">Submit Official Document</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleLayout>
  );
}