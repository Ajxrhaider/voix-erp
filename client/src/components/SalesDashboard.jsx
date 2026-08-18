import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { ArrowRight, ChevronRight, Landmark, Upload, Database, CheckCircle, Radio } from 'lucide-react';

const PIPELINE_STAGES = ['Lead', 'Qualification', 'Proposal', 'Negotiation', 'Closing', 'Won'];

export default function SalesDashboard() {
  const { sales, deployments, customers, ledger, authFetch } = useContext(AppContext);

  // Form Inputs State
  const [dealName, setDealName] = useState('');
  const [dealLoc, setDealLoc] = useState('');
  const [dealContact, setDealContact] = useState('');
  const [dealPlan, setDealPlan] = useState('SME Premium 50Mbps');
  const [dealAmount, setDealAmount] = useState('125000');

  const [depName, setDepName] = useState('');
  const [depLoc, setDepLoc] = useState('');
  const [depPlan, setDepPlan] = useState('Premium 30Mbps');
  const [depAmount, setDepAmount] = useState('95000');

  const [ipAllocationInput, setIpAllocationInput] = useState({});
  const [rawCsvText, setRawCsvText] = useState('');

  const handleCreateDeal = async (e) => {
    e.preventDefault();
    await authFetch('/api/sales/pipeline', {
      method: 'POST',
      body: JSON.stringify({ name: dealName, location: dealLoc, contact: dealContact, proposedPlan: dealPlan, stage: 'Lead', amount: parseFloat(dealAmount) })
    });
    setDealName(''); setDealLoc(''); setDealContact('');
  };

  const handleAdvanceStage = async (saleId, currentStage) => {
    const nextIdx = PIPELINE_STAGES.indexOf(currentStage) + 1;
    if (nextIdx >= PIPELINE_STAGES.length) return;
    await authFetch('/api/sales/pipeline/stage', {
      method: 'PUT',
      body: JSON.stringify({ saleId, targetStage: PIPELINE_STAGES[nextIdx] })
    });
  };

  const handleCreateManualDeployment = async (e) => {
    e.preventDefault();
    await authFetch('/api/deployments/manual', {
      method: 'POST',
      body: JSON.stringify({ customerName: depName, location: depLoc, plan: depPlan, amount: parseFloat(depAmount) })
    });
    setDepName(''); setDepLoc('');
  };

  const handleFinalizeDeployment = async (depId) => {
    const allocatedIp = ipAllocationInput[depId] || '10.200.4.12';
    await authFetch(`/api/deployments/${depId}/complete`, {
      method: 'PUT',
      body: JSON.stringify({ ipAddress: allocatedIp })
    });
  };

  const handleCsvBulkUpload = async () => {
    if (!rawCsvText.trim()) return;
    const lines = rawCsvText.split('\n');
    const header = lines[0].split(',');
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(',');
      const rowObj = {};
      header.forEach((col, idx) => {
        rowObj[col.trim()] = values[idx] ? values[idx].trim() : '';
      });
      rows.push(rowObj);
    }
    await authFetch('/api/crm/customers/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ rows })
    });
    setRawCsvText('');
  };

  return (
    <div className="space-y-8 text-xs font-sans">
      {/* 1. BITRIX24 PIPELINE VIEW */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-black uppercase text-white tracking-wider flex items-center gap-2">
            <Radio className="w-4 h-4 text-teal-400 animate-pulse" /> Direct Sales Funnel
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {PIPELINE_STAGES.map(stage => {
            const filteredDeals = sales.filter(s => s.stage === stage);
            return (
              <div key={stage} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="font-bold text-white uppercase tracking-tight text-[10px]">{stage}</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-mono text-teal-400">{filteredDeals.length}</span>
                </div>
                <div className="space-y-2 flex-1 overflow-y-auto max-h-60 pr-1">
                  {filteredDeals.map(deal => (
                    <div key={deal.id} className="bg-slate-950 border border-slate-850 rounded-lg p-2.5 space-y-2 hover:border-slate-700 transition">
                      <div>
                        <p className="font-bold text-slate-100 truncate">{deal.customer_name}</p>
                        <p className="text-[9px] font-mono text-slate-500">{deal.location}</p>
                      </div>
                      <div className="flex justify-between items-center pt-1.5 border-t border-slate-900">
                        <span className="font-mono text-emerald-400 font-bold">₦{deal.amount?.toLocaleString()}</span>
                        {stage !== 'Won' && (
                          <button onClick={() => handleAdvanceStage(deal.id, deal.stage)} className="p-1 bg-teal-600 hover:bg-teal-500 text-white rounded">
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. OPERATIONAL DATA CONSOLES */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Deal and Deployment Creation Terminals */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 text-[11px]">Initiate Funnel Lead</h3>
            <form onSubmit={handleCreateDeal} className="space-y-2.5">
              <input type="text" required placeholder="Customer Account Name" value={dealName} onChange={e => setDealName(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white font-medium" />
              <input type="text" required placeholder="Physical Installation Site" value={dealLoc} onChange={e => setDealLoc(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white font-medium" />
              <input type="text" required placeholder="Primary Contact Payload" value={dealContact} onChange={e => setDealContact(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white font-mono" />
              <div className="grid grid-cols-2 gap-2">
                <select value={dealPlan} onChange={e => setDealPlan(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white text-[11px]">
                  <option value="Premium 30Mbps">30Mbps</option>
                  <option value="SME Premium 50Mbps">50Mbps</option>
                  <option value="Enterprise Dedicated 100Mbps">100Mbps</option>
                </select>
                <input type="number" placeholder="Value" value={dealAmount} onChange={e => setDealAmount(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white font-mono" />
              </div>
              <button type="submit" className="w-full py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 text-white font-bold rounded uppercase tracking-wider transition">Inject Lead</button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 text-[11px]">Direct Deployment Order</h3>
            <form onSubmit={handleCreateManualDeployment} className="space-y-2.5">
              <input type="text" required placeholder="Customer Account Name" value={depName} onChange={e => setDepName(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white font-medium" />
              <input type="text" required placeholder="Deployment Base Target" value={depLoc} onChange={e => setDepLoc(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white font-medium" />
              <div className="grid grid-cols-2 gap-2">
                <select value={depPlan} onChange={e => setDepPlan(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white text-[11px]">
                  <option value="Premium 30Mbps">30Mbps</option>
                  <option value="SME Premium 50Mbps">50Mbps</option>
                </select>
                <input type="number" placeholder="Cost" value={depAmount} onChange={e => setDepAmount(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white font-mono" />
              </div>
              <button type="submit" className="w-full py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-bold rounded uppercase tracking-wider transition">Deploy Pipeline</button>
            </form>
          </div>
        </div>

        {/* Deployments Processing Queue Dashboard */}
        <div className="xl:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col">
          <h3 className="font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 text-[11px]">Active Provisioning and Deployment Terminal</h3>
          <div className="space-y-2 overflow-y-auto max-h-[430px] flex-1 pr-1">
            {deployments.map(dep => (
              <div key={dep.id} className="bg-slate-950 border border-slate-850 rounded-xl p-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800">{dep.id}</span>
                    <h4 className="font-bold text-white">{dep.customer_name}</h4>
                  </div>
                  <p className="text-slate-400 font-mono text-[10px]">{dep.location} • <strong className="text-teal-400">{dep.plan}</strong></p>
                </div>
                <div className="flex items-center space-x-2 w-full md:w-auto">
                  {dep.status !== 'Completed' ? (
                    <>
                      <input type="text" placeholder="Assign Static IP Configuration" value={ipAllocationInput[dep.id] || ''} onChange={e => setIpAllocationInput({ ...ipAllocationInput, [dep.id]: e.target.value })} className="bg-slate-900 border border-slate-800 rounded p-1.5 text-white text-[11px] font-mono focus:outline-none focus:border-teal-500 w-full md:w-44" />
                      <button onClick={() => handleFinalizeDeployment(dep.id)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold uppercase tracking-wider text-[10px] whitespace-nowrap">Provision Base</button>
                    </>
                  ) : (
                    <span className="px-2.5 py-1 rounded bg-teal-500/10 border border-teal-500/30 font-bold font-mono text-[10px] text-teal-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Fully Synced Profile
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. BULK DATABASE IMPORT & LEDGER OVERVIEWS */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 text-[11px] flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5 text-teal-400" /> Database CSV Bulk Refresher
          </h3>
          <p className="text-[10px] text-slate-400 leading-normal">Paste your raw Excel row matrix directly into the parsing compiler downstream. Columns must align exactly: <code className="text-teal-400 font-mono font-bold">id,name,email,phone,location,plan,balance</code></p>
          <textarea rows="5" placeholder="id,name,email,phone,location,plan,balance&#10;CUST-101,John Doe,john@voix.net,0801,Abuja,Premium 30Mbps,0" value={rawCsvText} onChange={e => setRawCsvText(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-white font-mono placeholder:text-slate-700 focus:outline-none focus:border-teal-500 text-[11px]" />
          <button onClick={handleCsvBulkUpload} className="w-full py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-bold rounded uppercase tracking-wider flex items-center justify-center gap-1">
            <Database className="w-3.5 h-3.5" /> Compile Structural Rows
          </button>
        </div>

        <div className="xl:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 text-[11px] flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-teal-400" /> Accounting Transaction Ledger
          </h3>
          <div className="space-y-2 overflow-y-auto max-h-56 pr-1">
            {ledger.map(log => (
              <div key={log.id} className="bg-slate-950 border border-slate-850 rounded-lg p-2 flex justify-between items-center">
                <div>
                  <p className="font-bold text-white text-[11px]">{log.category}</p>
                  <p className="text-[9px] font-mono text-slate-500">Ref: {log.reference_id} • {log.created_at?.slice(0, 16)}</p>
                </div>
                <span className={`font-mono font-black text-[11px] ${log.type === 'Income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {log.type === 'Income' ? '+' : '-'}₦{log.amount?.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 text-[11px]">Production Customer Profiles</h3>
          <div className="space-y-2 overflow-y-auto max-h-56 pr-1">
            {customers.map(cust => (
              <div key={cust.id} className="bg-slate-950 border border-slate-850 rounded-lg p-2.5 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-200 truncate max-w-[150px]">{cust.name}</span>
                  <span className="text-[9px] font-mono bg-slate-900 border border-slate-800 px-1 rounded text-teal-400">{cust.ip_address}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span>Plan: <strong className="text-slate-300 font-medium">{cust.plan}</strong></span>
                  <span className="font-mono text-[9px] text-slate-400">{cust.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}