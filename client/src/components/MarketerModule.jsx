import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { downloadPDF } from '../utils/generateInvoice';
import { TrendingUp, Send, MapPin, Receipt, ClipboardCheck, Wrench, DollarSign, Check } from 'lucide-react';

export default function MarketerModule() {
  const { surveyTickets, authFetch } = useContext(AppContext);

  const [newSurveyCustomer, setNewSurveyCustomer] = useState('');
  const [newSurveyLocation, setNewSurveyLocation] = useState('');
  const [newSurveyContact, setNewSurveyContact] = useState('');
  const [newSurveyPlan, setNewSurveyPlan] = useState('SME Premium 50Mbps');
  
  const [surveyUnderProcess, setSurveyUnderProcess] = useState(null);
  const [techDistance, setTechDistance] = useState('');
  const [techPoles, setTechPoles] = useState('');
  const [techNotes, setTechNotes] = useState('');
  const [techLabour, setTechLabour] = useState('20000');

  const handleRaiseSurveyRequest = async (e) => {
    e.preventDefault();
    await authFetch('/api/survey-tickets', {
      method: 'POST',
      body: JSON.stringify({
        id: `SRV-${Date.now().toString().slice(-4)}`,
        customer: newSurveyCustomer,
        location: newSurveyLocation,
        contactPerson: newSurveyContact,
        proposedPlan: newSurveyPlan,
        marketerName: 'Sales Rep'
      })
    });
    setNewSurveyCustomer(''); setNewSurveyLocation(''); setNewSurveyContact('');
  };

  const handleSubmitSurveyAdvice = async (e) => {
    e.preventDefault();
    const distance = parseFloat(techDistance) || 100;
    const poles = parseInt(techPoles) || 0;
    const labour = parseFloat(techLabour) || 20000;
    const calculatedMaterialCost = (distance * 250) + (poles * 12000);
    const standardRouterCost = 18000;
    const totalQuote = calculatedMaterialCost + standardRouterCost + labour;

    await authFetch(`/api/survey-tickets/${surveyUnderProcess.id}/field-quote`, {
      method: 'PUT',
      body: JSON.stringify({
        distanceMeters: distance, polesRequired: poles, cableType: "4-Core Drop",
        technicianNotes: techNotes, surveyedBy: "IT Desk", materialCost: calculatedMaterialCost,
        routerCost: standardRouterCost, installationLabour: labour, totalQuote: totalQuote
      })
    });
    setSurveyUnderProcess(null);
  };

  const handleGenerateSurveyInvoice = async (srvId) => {
    const invoiceCode = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    await authFetch(`/api/survey-tickets/${srvId}/invoice`, {
      method: 'PUT',
      body: JSON.stringify({ invoiceRef: invoiceCode })
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2">
            <Send className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">1. Marketer: Survey Request</h3>
          </div>
          <form onSubmit={handleRaiseSurveyRequest} className="space-y-3 pt-2 text-xs">
            <input type="text" required placeholder="Customer Name" value={newSurveyCustomer} onChange={e => setNewSurveyCustomer(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono" />
            <input type="text" required placeholder="Location Address" value={newSurveyLocation} onChange={e => setNewSurveyLocation(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono" />
            <input type="text" placeholder="Contact Person" value={newSurveyContact} onChange={e => setNewSurveyContact(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono" />
            <select value={newSurveyPlan} onChange={e => setNewSurveyPlan(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white">
              <option value="Premium 30Mbps">Premium 30Mbps</option>
              <option value="SME Premium 50Mbps">SME Premium 50Mbps</option>
              <option value="Enterprise Dedicated 100Mbps">Enterprise Dedicated 100Mbps</option>
            </select>
            <button type="submit" className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg uppercase tracking-wider flex items-center justify-center gap-1.5">
              <span>Dispatch Request</span><Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-8 space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <ClipboardCheck className="text-emerald-400 w-4 h-4" /> Active Pipeline
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {surveyTickets.map(s => (
              <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500">{s.id}</span>
                    <h4 className="text-sm font-bold text-white">{s.customer}</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-400 bg-emerald-500/20">{s.status}</span>
                </div>
                
                {s.status === "Pending Survey" && (
                  <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400">Awaiting IT Desk...</span>
                    <button onClick={() => setSurveyUnderProcess(s)} className="px-3 py-1 bg-amber-600 text-white text-xs rounded">Input Technical Params (IT)</button>
                  </div>
                )}

                {s.status === "Survey Completed (AQ Issued)" && (
                  <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400">Total Quote: ₦{s.totalQuote?.toLocaleString()}</span>
                    <div className="flex space-x-2">
                      <button onClick={() => downloadPDF(s)} className="px-3 py-1 bg-teal-600 text-white text-xs rounded">Download PDF</button>
                      <button onClick={() => handleGenerateSurveyInvoice(s.id)} className="px-3 py-1 bg-indigo-600 text-white text-xs rounded">Mark as Paid & Install</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* IT Modal */}
        {surveyUnderProcess && (
          <div className="bg-slate-900 border-2 border-indigo-500 rounded-2xl p-6 space-y-4 mt-6">
            <h4 className="font-bold text-white">IT Field Survey Entry Desk ({surveyUnderProcess.customer})</h4>
            <form onSubmit={handleSubmitSurveyAdvice} className="space-y-4 text-xs">
              <input type="number" required placeholder="Distance (Meters)" value={techDistance} onChange={e => setTechDistance(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" />
              <input type="number" placeholder="Poles" value={techPoles} onChange={e => setTechPoles(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white" />
              <button type="submit" className="w-full py-2 bg-indigo-600 text-white font-bold rounded uppercase">Issue Advice of Quote</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}