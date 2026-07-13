// CRMModule.jsx
import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { Users, AlertCircle, CheckCircle2, ShieldAlert, Plus, Radio, Wifi, Database } from 'lucide-react';

export default function CRMModule() {
  const { customers, authFetch, refreshData } = useContext(AppContext);
  const [crmSubTab, setCrmSubTab] = useState('profiles'); // 'profiles', 'queries', 'deployments'
  const [queryTickets, setQueryTickets] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  
  // Form states
  const [interactionType, setInteractionType] = useState('WhatsApp Chat');
  const [interactionDetails, setInteractionDetails] = useState('');
  const [raiseAsTicket, setRaiseAsTicket] = useState(false);
  const [ticketType, setTicketType] = useState('Router Configuration');
  
  // Deployment Activations State
  const [activeDeploy, setActiveDeploy] = useState(null);
  const [ipAddr, setIpAddr] = useState('102.89.46.x');
  const [opticalLevel, setOpticalLevel] = useState('-19.5 dBm');
  const [oltProfile, setOltProfile] = useState('Enterprise_100M_Profile');

  useEffect(() => {
    fetchQueriesAndDeployments();
    if (customers?.length > 0 && !selectedProfileId) {
      setSelectedProfileId(customers[0].id);
    }
  }, [customers]);

  const fetchQueriesAndDeployments = async () => {
    try {
      const qRes = await authFetch('/api/query-tickets');
      if (qRes.ok) setQueryTickets(await qRes.json());
      const dRes = await authFetch('/api/pending-deployments');
      if (dRes.ok) setDeployments(await dRes.json());
    } catch (e) { console.error(e); }
  };

  const handleLogInteraction = async (e) => {
    e.preventDefault();
    if (!interactionDetails || !selectedProfileId) return;
    const targetCust = customers.find(c => c.id === selectedProfileId);

    try {
      await authFetch('/api/customers/interaction', {
        method: 'POST',
        body: JSON.stringify({
          id: selectedProfileId,
          interaction: {
            date: new Date().toISOString().substring(0, 10),
            type: interactionType,
            details: interactionDetails,
            agent: 'Active Terminal CRM Desk'
          }
        })
      });

      if (raiseAsTicket) {
        await authFetch('/api/query-tickets', {
          method: 'POST',
          body: JSON.stringify({
            ticketNo: `TKT-2026-${Date.now().toString().slice(-4)}`,
            dateReceived: new Date().toISOString().substring(0, 10),
            timeReceived: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            customerIp: targetCust?.ipAddress || 'Dynamic Allocation',
            customerName: targetCust?.name,
            queryType: ticketType,
            location: targetCust?.location,
            serviceType: targetCust?.serviceType,
            issueDescription: interactionDetails,
            ticketOpenedBy: 'CRM Desk',
            whatsappSosSent: 'Y',
            assignedTo: 'NOC Desk',
            queryStatus: 'Open'
          })
        });
      }
      setInteractionDetails('');
      setRaiseAsTicket(false);
      refreshData();
      fetchQueriesAndDeployments();
    } catch (err) { console.error(err); }
  };

  const handleProvisionNetwork = async (e) => {
    e.preventDefault();
    if (!activeDeploy) return;
    try {
      const res = await authFetch(`/api/pending-deployments/${activeDeploy.id}/activate`, {
        method: 'POST',
        body: JSON.stringify({ assignedIpAddress: ipAddr, opticalReading: opticalLevel, oltProfile })
      });
      if (res.ok) {
        setActiveDeploy(null);
        fetchQueriesAndDeployments();
        alert("NOC Live Push Completed! Static Routing Matrix Engaged.");
      }
    } catch (err) { console.error(err); }
  };

  const activeCustomer = customers.find(c => c.id === selectedProfileId);

  return (
    <div className="space-y-6 text-slate-100 font-sans">
      {/* Tab Navigation header */}
      <div className="flex border-b border-slate-800 space-x-4 pb-2">
        {['profiles', 'queries', 'deployments'].map((t) => (
          <button
            key={t}
            onClick={() => setCrmSubTab(t)}
            className={`capitalize font-medium text-sm pb-2 px-1 transition-all ${crmSubTab === t ? 'border-b-2 border-teal-500 text-teal-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {t === 'profiles' ? 'Customer Accounts' : t === 'queries' ? 'SLA Ticket Registry' : 'NOC Live Provisioning'}
          </button>
        ))}
      </div>

      {crmSubTab === 'profiles' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profiles selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 max-h-[600px] overflow-y-auto">
            <h3 className="text-xs font-bold font-mono tracking-widest text-slate-400 mb-3">CRM CORE INDEX</h3>
            <div className="space-y-2">
              {customers.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedProfileId(c.id)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${selectedProfileId === c.id ? 'bg-teal-950/40 border-teal-500/50' : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'}`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{c.id}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${c.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{c.status}</span>
                  </div>
                  <h4 className="font-bold text-sm text-white mt-2 truncate">{c.name}</h4>
                  <p className="text-xs text-slate-400 font-mono mt-1">{c.ipAddress || 'Awaiting IP Address'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Configuration and Interaction Logs */}
          {activeCustomer ? (
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-sm font-bold text-teal-400 mb-4">Account Metadata Profile</h3>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono mb-4">
                  <div><span className="text-slate-500">Address Node:</span> <p className="text-slate-200 mt-0.5">{activeCustomer.location}</p></div>
                  <div><span className="text-slate-500">Contact Vector:</span> <p className="text-slate-200 mt-0.5">{activeCustomer.contact}</p></div>
                  <div><span className="text-slate-500">Bandwidth Package:</span> <p className="text-teal-400 mt-0.5">{activeCustomer.serviceType}</p></div>
                  <div><span className="text-slate-500">Billing Token:</span> <p className="text-emerald-400 mt-0.5">{activeCustomer.billingStatus}</p></div>
                </div>

                <form onSubmit={handleLogInteraction} className="border-t border-slate-800 pt-4 space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Log Dynamic Customer Contact</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-500 text-xs mb-1">Channel Vector</label>
                      <select value={interactionType} onChange={e => setInteractionType(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white">
                        <option>WhatsApp Chat</option>
                        <option>Voice Dispatch</option>
                        <option>Email Portal</option>
                      </select>
                    </div>
                    {raiseAsTicket && (
                      <div>
                        <label className="block text-slate-500 text-xs mb-1">Ticket Fault Domain</label>
                        <select value={ticketType} onChange={e => setTicketType(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white">
                          <option>Router Configuration</option>
                          <option>Fiber Cut Fault</option>
                          <option>High Packet Drop</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-slate-500 text-xs mb-1">Interaction / Fault Chronicle Details</label>
                    <textarea rows="2" value={interactionDetails} onChange={e => setInteractionDetails(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white outline-none" placeholder="Provide raw summary inputs..."></textarea>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="raise" checked={raiseAsTicket} onChange={e => setRaiseAsTicket(e.target.checked)} className="rounded border-slate-800 bg-slate-950 text-teal-500" />
                    <label htmlFor="raise" className="text-xs text-slate-400 cursor-pointer">Escalate directly into enterprise SLA Open Ticket Matrix</label>
                  </div>
                  <button type="submit" className="bg-teal-600 hover:bg-teal-700 font-medium text-xs px-4 py-2 rounded text-white">Commit Interaction Log Vector</button>
                </form>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 text-slate-500 text-xs flex items-center justify-center border border-dashed border-slate-800 rounded-xl">Select an operational client record.</div>
          )}
        </div>
      )}

      {crmSubTab === 'queries' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 overflow-x-auto">
          <h3 className="font-bold text-sm text-teal-400 mb-4 font-mono">UNIFIED SLA WORKSPACE MATRIX</h3>
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-3">Ticket No</th>
                <th className="p-3">Client Nodes</th>
                <th className="p-3">Domain Fault</th>
                <th className="p-3">Assigned Queue</th>
                <th className="p-3">SLA Status</th>
                <th className="p-3">MTTR Metrics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {queryTickets.map(t => (
                <tr key={t.ticketNo} className="hover:bg-slate-950/40">
                  <td className="p-3 font-mono text-teal-400">{t.ticketNo}</td>
                  <td className="p-3">
                    <p className="font-bold text-white">{t.customerName}</p>
                    <span className="text-[10px] text-slate-500 font-mono">{t.customerIp}</span>
                  </td>
                  <td className="p-3">{t.queryType}</td>
                  <td className="p-3 text-slate-400">{t.assignedTo}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.queryStatus === 'Resolved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400 animate-pulse'}`}>{t.queryStatus}</span>
                  </td>
                  <td className="p-3 font-mono text-slate-400">{t.mttr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {crmSubTab === 'deployments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 lg:col-span-1">
            <h3 className="text-xs font-mono font-bold text-slate-400 mb-3">PROVISIONING WORKLISTS</h3>
            <div className="space-y-2">
              {deployments.map(d => (
                <div key={d.id} onClick={() => setActiveDeploy(d)} className={`p-3 border rounded-lg cursor-pointer transition-all ${activeDeploy?.id === d.id ? 'bg-teal-950/40 border-teal-500' : 'bg-slate-950 border-slate-800'}`}>
                  <h4 className="font-bold text-xs text-white">{d.customer}</h4>
                  <p className="text-[11px] text-slate-400 mt-1">{d.plan}</p>
                  <div className="flex justify-between items-center mt-2 text-[10px] font-mono">
                    <span className="text-slate-500">{d.paidDate}</span>
                    <span className="text-amber-400">{d.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            {activeDeploy ? (
              <form onSubmit={handleProvisionNetwork} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-teal-400">NOC Backend Core Loop Provisioning</h3>
                <div className="p-3 bg-slate-950 border border-slate-850 rounded text-xs text-slate-300 font-mono space-y-1">
                  <p><span className="text-slate-500">Target Client:</span> {activeDeploy.customer}</p>
                  <p><span className="text-slate-500">Pipeline Plan:</span> {activeDeploy.plan}</p>
                  <p><span className="text-slate-500">Deployment Node:</span> {activeDeploy.location}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-500 text-xs mb-1">Static IP Allocation</label>
                    <input type="text" value={ipAddr} onChange={e => setIpAddr(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-white outline-none" />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-xs mb-1">Optical Transceiver Level</label>
                    <input type="text" value={opticalLevel} onChange={e => setOpticalLevel(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-white outline-none" />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-xs mb-1">GPON Profile Template</label>
                    <select value={oltProfile} onChange={e => setOltProfile(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white">
                      <option>Enterprise_100M_Profile</option>
                      <option>SME_Symmetric_50M</option>
                      <option>Premium_Residential_30M</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 font-bold text-xs py-2.5 rounded text-white">Push Static Route Configuration to OLT Stack</button>
              </form>
            ) : (
              <div className="h-full border border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-500 text-xs p-12">Select a pending account deployment node to allocate loop templates.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}