import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { ShoppingCart, CheckCircle2, Clock } from 'lucide-react';

export default function RequisitionsModule() {
  const { requisitions, user, token } = useContext(AppContext);
  const [form, setForm] = useState({ department: '', item: '', quantity: 1, estimatedCost: '' });
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetch(`${API_URL}/api/requisitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(form)
    });
    window.location.reload(); // Quick refresh for MVP
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center"><ShoppingCart className="w-4 h-4 mr-2" /> Raise Requisition</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Department (e.g. NOC, Fiber)" required onChange={e => setForm({...form, department: e.target.value})} className="w-full border p-2 rounded text-sm" />
          <input type="text" placeholder="Item requested" required onChange={e => setForm({...form, item: e.target.value})} className="w-full border p-2 rounded text-sm" />
          <input type="number" placeholder="Quantity" required onChange={e => setForm({...form, quantity: e.target.value})} className="w-full border p-2 rounded text-sm" />
          <input type="number" placeholder="Estimated Cost (₦)" required onChange={e => setForm({...form, estimatedCost: e.target.value})} className="w-full border p-2 rounded text-sm" />
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium">Submit to GM</button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">Recent Requisitions</h3>
        <div className="space-y-3">
          {requisitions.map(req => (
            <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
              <div>
                <p className="font-medium text-slate-800 text-sm">{req.item} <span className="text-slate-500 font-normal">x{req.quantity}</span></p>
                <p className="text-xs text-slate-500 font-mono">From: {req.department} • By: {req.requestedBy}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-700">₦{req.estimatedCost}</p>
                {req.status === 'Approved' ? (
                  <span className="text-xs text-emerald-600 flex items-center justify-end font-medium"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</span>
                ) : (
                  <span className="text-xs text-amber-600 flex items-center justify-end font-medium"><Clock className="w-3 h-3 mr-1" /> Pending GM</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}