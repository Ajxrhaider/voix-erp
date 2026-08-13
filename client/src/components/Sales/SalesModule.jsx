// SalesModule.jsx
import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { TrendingUp, Plus, FileText, ClipboardCheck, Receipt, ArrowRight } from 'lucide-react';

export default function SalesModule() {
  const { authFetch } = useContext(AppContext);
  const [surveyTickets, setSurveyTickets] = useState([]);
  
  // New Survey State
  const [cust, setCust] = useState('');
  const [loc, setLoc] = useState('');
  const [contact, setContact] = useState('');
  const [plan, setPlan] = useState('SME Premium 50Mbps');

  // IT Field Quote Advice Form State
  const [processingId, setProcessingId] = useState(null);
  const [distance, setDistance] = useState('350');
  const [poles, setPoles] = useState('4');
  const [notes, setNotes] = useState('FAT box clean and empty. Good optical parameters.');
  const [matCost, setMatCost] = useState('45000');
  const [labour, setLabour] = useState('25000');

  useEffect(() => {
    loadSurveyPipeline();
  }, []);

  const loadSurveyPipeline = async () => {
    try {
      const res = await authFetch('/api/survey-tickets');
      if (res.ok) setSurveyTickets(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleCreateSurveyRequest = async (e) => {
    e.preventDefault();
    if (!cust || !loc) return;
    try {
      await authFetch('/api/survey-tickets', {
        method: 'POST',
        body: JSON.stringify({
          id: `SRV-2026-${Date.now().toString().slice(-3)}`,
          customer: cust, location: loc, contactPerson: contact, proposedPlan: plan, marketerName: 'Sarah Udoh'
        })
      });
      setCust(''); setLoc(''); setContact('');
      loadSurveyPipeline();
    } catch (err) { console.error(err); }
  };

  const handleIssueAdviceOfQuote = async (e) => {
    e.preventDefault();
    const total = Number(matCost) + Number(labour) + 15000; // adding baseline router cost
    try {
      await authFetch(`/api/survey-tickets/${processingId}/field-quote`, {
        method: 'PUT',
        body: JSON.stringify({
          distanceMeters: Number(distance), polesRequired: Number(poles), cableType: '4-Core Drop Cable',
          technicianNotes: notes, surveyedBy: 'IT Field Desk', materialCost: Number(matCost), routerCost: 15000,
          installationLabour: Number(labour), totalQuote: total
        })
      });
      setProcessingId(null);
      loadSurveyPipeline();
    } catch (err) { console.error(err); }
  };

  const handleReconcileInvoice = async (id) => {
    try {
      await authFetch(`/api/survey-tickets/${id}/invoice`, {
        method: 'PUT',
        body: JSON.stringify({ invoiceRef: `INV-RF-${Date.now().toString().slice(-4)}` })
      });
      loadSurveyPipeline();
      alert("Invoice Paid! Pipeline forwarded automatically to NOC Splicing Queue.");
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6 text-slate-100 font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form panel to trigger pre-sales survey requests */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-teal-400 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Initialize Pre-Sales Survey
          </h3>
          <form onSubmit={handleCreateSurveyRequest} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">Prospect Entity / Customer</label>
              <input type="text" value={cust} onChange={e => setCust(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white outline-none" placeholder="e.g. Sterling Plaza" />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Geographic Location Parameters</label>
              <input type="text" value={loc} onChange={e => setLoc(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white outline-none" placeholder="e.g. Plot 15, Victoria Island" />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Contact Coordinator Vector</label>
              <input type="text" value={contact} onChange={e => setContact(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white outline-none" placeholder="Name and Phone Number" />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Proposed Topology Plan</label>
              <select value={plan} onChange={e => setPlan(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white">
                <option>Enterprise Dedicated 100Mbps</option>
                <option>SME Premium 50Mbps</option>
                <option>Premium 30Mbps</option>
              </select>
            </div>
            <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 rounded mt-2 transition-all">Submit Survey Matrix Request</button>
          </form>
        </div>

        {/* Dynamic processing component window */}
        <div className="lg:col-span-2 space-y-6">
          {processingId && (
            <form onSubmit={handleIssueAdviceOfQuote} className="bg-slate-900 border border-teal-900/60 bg-gradient-to-b from-slate-900 to-slate-950 p-5 rounded-xl space-y-4">
              <h3 className="text-xs font-bold text-teal-400 font-mono tracking-widest uppercase">IT FIELD SURVEY DETAILS & ADVICE OF QUOTE (AQ)</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1">Distance Parameters (Meters)</label>
                  <input type="number" value={distance} onChange={e => setDistance(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Ancillary Poles Needed</label>
                  <input type="number" value={poles} onChange={e => setPoles(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Estimated Drop Material Cost</label>
                  <input type="number" value={matCost} onChange={e => setMatCost(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-slate-500 mb-1">Technical Field Assessment Reports</label>
                  <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Splicing Labour Bill</label>
                  <input type="number" value={labour} onChange={e => setLabour(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono" />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setProcessingId(null)} className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded">Cancel</button>
                <button type="submit" className="text-xs font-bold text-slate-950 bg-teal-400 px-4 py-1.5 rounded hover:bg-teal-300">Commit AQ Advice Bundle</button>
              </div>
            </form>
          )}

          {/* Unified pre-sales ledger workflow visual */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 overflow-x-auto">
            <h3 className="font-mono text-xs font-bold tracking-wider text-slate-400 mb-4">PRE-SALES PIPELINE LEDGER STACK</h3>
            <div className="space-y-3">
              {surveyTickets.map(s => (
                <div key={s.id} className="p-4 bg-slate-950 border border-slate-850 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{s.id}</span>
                      <h4 className="font-bold text-white text-sm">{s.customer}</h4>
                    </div>
                    <p className="text-slate-400 mt-1 font-mono text-[11px]">{s.location} • {s.proposedPlan}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">Assigned Agent: {s.marketerName}</p>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    <span className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase ${s.status.includes('Pending') ? 'bg-amber-500/10 text-amber-400' : s.status.includes('Completed') ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {s.status}
                    </span>
                    
                    {s.status === 'Pending Survey' && (
                      <button onClick={() => setProcessingId(s.id)} className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-mono text-[11px] px-3 py-1.5 rounded flex items-center gap-1">
                        Log Field AQ <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                    
                    {s.status === 'Survey Completed (AQ Issued)' && (
                      <button onClick={() => handleReconcileInvoice(s.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded flex items-center gap-1">
                        Reconcile Payment <Receipt className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}