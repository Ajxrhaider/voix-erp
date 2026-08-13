import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { ChevronRight, Landmark, Upload, Database, CheckCircle, Target } from 'lucide-react';

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
    <div className="space-y-8 font-sans">
      
      {/* 1. SALES PIPELINE VIEW */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Target className="w-5 h-5 text-voix-600" /> Sales Pipeline
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {PIPELINE_STAGES.map(stage => {
            const filteredDeals = sales.filter(s => s.stage === stage);
            return (
              <div key={stage} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-700 text-sm">{stage}</span>
                  <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-500">{filteredDeals.length}</span>
                </div>
                <div className="space-y-2 flex-1 overflow-y-auto max-h-64 pr-1">
                  {filteredDeals.map(deal => (
                    <div key={deal.id} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 shadow-sm hover:border-voix-300 transition-colors">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm truncate">{deal.customer_name}</p>
                        <p className="text-xs text-slate-500 truncate">{deal.location}</p>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                        <span className="text-xs font-semibold text-emerald-600">₦{deal.amount?.toLocaleString()}</span>
                        {stage !== 'Won' && (
                          <button onClick={() => handleAdvanceStage(deal.id, deal.stage)} className="p-1 bg-slate-100 hover:bg-voix-50 hover:text-voix-600 text-slate-400 rounded transition-colors" title="Move to next stage">
                            <ChevronRight className="w-4 h-4" />
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
        
        {/* Deal and Deployment Creation Forms */}
        <div className="xl:col-span-4 space-y-6">
          
          {/* Add Lead Form */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 text-sm">Add New Lead</h3>
            <form onSubmit={handleCreateDeal} className="space-y-3 text-sm">
              <input type="text" required placeholder="Customer / Business Name" value={dealName} onChange={e => setDealName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-voix-500 focus:ring-1 focus:ring-voix-500" />
              <input type="text" required placeholder="Installation Address" value={dealLoc} onChange={e => setDealLoc(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-voix-500 focus:ring-1 focus:ring-voix-500" />
              <input type="text" required placeholder="Contact Number / Email" value={dealContact} onChange={e => setDealContact(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-voix-500 focus:ring-1 focus:ring-voix-500" />
              <div className="grid grid-cols-2 gap-3">
                <select value={dealPlan} onChange={e => setDealPlan(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-voix-500 focus:ring-1 focus:ring-voix-500">
                  <option value="Premium 30Mbps">30Mbps</option>
                  <option value="SME Premium 50Mbps">50Mbps</option>
                  <option value="Enterprise Dedicated 100Mbps">100Mbps</option>
                </select>
                <input type="number" placeholder="Deal Value" value={dealAmount} onChange={e => setDealAmount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-voix-500 focus:ring-1 focus:ring-voix-500" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-voix-600 hover:bg-voix-700 text-white font-semibold rounded-lg transition-colors">Save Lead</button>
            </form>
          </div>

          {/* Add Deployment Form */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 text-sm">New Installation Task</h3>
            <form onSubmit={handleCreateManualDeployment} className="space-y-3 text-sm">
              <input type="text" required placeholder="Customer Name" value={depName} onChange={e => setDepName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-voix-500 focus:ring-1 focus:ring-voix-500" />
              <input type="text" required placeholder="Installation Address" value={depLoc} onChange={e => setDepLoc(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-voix-500 focus:ring-1 focus:ring-voix-500" />
              <div className="grid grid-cols-2 gap-3">
                <select value={depPlan} onChange={e => setDepPlan(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-voix-500 focus:ring-1 focus:ring-voix-500">
                  <option value="Premium 30Mbps">30Mbps</option>
                  <option value="SME Premium 50Mbps">50Mbps</option>
                </select>
                <input type="number" placeholder="Setup Cost" value={depAmount} onChange={e => setDepAmount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-voix-500 focus:ring-1 focus:ring-voix-500" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg transition-colors">Create Deployment</button>
            </form>
          </div>
        </div>

        {/* Deployments Processing Queue Dashboard */}
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col space-y-4">
          <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 text-sm">Active Deployments</h3>
          <div className="space-y-3 overflow-y-auto max-h-[500px] flex-1 pr-2">
            {deployments.map(dep => (
              <div key={dep.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-600">{dep.id}</span>
                    <h4 className="font-semibold text-slate-800">{dep.customer_name}</h4>
                  </div>
                  <p className="text-slate-500 text-xs">{dep.location} • <strong className="text-voix-600">{dep.plan}</strong></p>
                </div>
                <div className="flex items-center space-x-3 w-full md:w-auto">
                  {dep.status !== 'Completed' ? (
                    <>
                      <input type="text" placeholder="Assign Static IP" value={ipAllocationInput[dep.id] || ''} onChange={e => setIpAllocationInput({ ...ipAllocationInput, [dep.id]: e.target.value })} className="bg-white border border-slate-200 rounded-md p-2 text-slate-700 text-sm focus:outline-none focus:border-voix-500 focus:ring-1 focus:ring-voix-500 w-full md:w-48" />
                      <button onClick={() => handleFinalizeDeployment(dep.id)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-semibold text-xs whitespace-nowrap transition-colors">Complete Setup</button>
                    </>
                  ) : (
                    <span className="px-3 py-1.5 rounded-md bg-emerald-50 border border-emerald-200 font-medium text-xs text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" /> Setup Complete
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
        
        {/* CSV Import */}
        <div className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 text-sm flex items-center gap-2">
            <Upload className="w-4 h-4 text-voix-600" /> Bulk Import Customers
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">Paste your CSV data here. Please ensure columns match exactly: <br/><code className="text-slate-700 font-mono bg-slate-100 px-1 rounded">id,name,email,phone,location,plan,balance</code></p>
          <textarea rows="5" placeholder="id,name,email,phone,location,plan,balance&#10;CUST-101,John Doe,john@voix.net,0801,Abuja,Premium 30Mbps,0" value={rawCsvText} onChange={e => setRawCsvText(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 text-sm font-mono placeholder:text-slate-400 focus:outline-none focus:border-voix-500 focus:ring-1 focus:ring-voix-500" />
          <button onClick={handleCsvBulkUpload} className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
            <Database className="w-4 h-4" /> Import Customers
          </button>
        </div>

        {/* Accounting Ledger */}
        <div className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 text-sm flex items-center gap-2">
            <Landmark className="w-4 h-4 text-voix-600" /> Recent Transactions
          </h3>
          <div className="space-y-3 overflow-y-auto max-h-60 pr-2">
            {ledger.map(log => (
              <div key={log.id} className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-slate-800 text-xs">{log.category}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Ref: {log.reference_id} • {log.created_at?.slice(0, 16)}</p>
                </div>
                <span className={`font-semibold text-sm ${log.type === 'Income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {log.type === 'Income' ? '+' : '-'}₦{log.amount?.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Profiles */}
        <div className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 text-sm">Customer Directory</h3>
          <div className="space-y-3 overflow-y-auto max-h-60 pr-2">
            {customers.map(cust => (
              <div key={cust.id} className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-800 text-sm truncate max-w-[160px]">{cust.name}</span>
                  <span className="text-[10px] font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-voix-600">{cust.ip_address}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Plan: <strong className="text-slate-700 font-medium">{cust.plan}</strong></span>
                  <span className="font-mono text-[10px]">{cust.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}