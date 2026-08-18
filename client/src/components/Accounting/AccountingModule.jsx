import React, { useState, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { Calculator } from 'lucide-react';

export default function AccountingModule() {
  const { requisitions, authFetch, refreshData } = useContext(AppContext);
  const [reqDept, setReqDept] = useState('Operations');
  const [reqItem, setReqItem] = useState('');
  const [reqCost, setReqCost] = useState('');

  const submitRequisition = async (e) => {
    e.preventDefault();
    const payload = {
      id: `REQ-${Date.now().toString().slice(-4)}`,
      dept: reqDept, 
      item: reqItem, 
      qty: 1, 
      estCost: Number(reqCost), 
      reason: "ERP Entry", 
      status: "Pending"
    };

    // Correct endpoint matching server.js
    const res = await authFetch('/api/requisitions', { 
      method: 'POST', 
      body: JSON.stringify(payload) 
    });
    
    if (res.ok) {
      setReqItem(''); 
      setReqCost(''); 
      refreshData();
    }
  };

  const updateStatus = async (id, status) => {
    // Note: If you haven't implemented a specific status update route in server.js yet,
    // you may need to add: app.put('/api/requisitions/:id', ...)
    // For now, I've simplified this to focus on the POST method
    alert("Status update logic needs corresponding backend endpoint.");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-600" />
          Request Funds / Expense
        </h3>
        <form onSubmit={submitRequisition} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
            <select 
              value={reqDept} 
              onChange={(e) => setReqDept(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-sm"
            >
              <option>Operations</option>
              <option>IT</option>
              <option>Field</option>
              <option>Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Item/Description</label>
            <input 
              type="text" 
              required 
              value={reqItem} 
              onChange={(e) => setReqItem(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Estimated Cost (₦)</label>
            <input 
              type="number" 
              required 
              value={reqCost} 
              onChange={(e) => setReqCost(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-sm"
            />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white font-medium py-2 rounded-lg text-sm hover:bg-blue-700">
            Submit Requisition
          </button>
        </form>
      </div>

      <div className="md:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">Finance & Requisition Ledger</h3>
        <div className="space-y-3">
          {requisitions.length === 0 ? (
            <p className="text-sm text-slate-500">No active requisitions.</p>
          ) : (
            requisitions.map(req => (
              <div key={req.id} className="p-4 border rounded-lg flex justify-between items-center bg-slate-50">
                <div>
                  <span className="text-xs font-bold text-blue-600">{req.id} ({req.dept})</span>
                  <p className="font-medium text-slate-800">{req.item}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800">₦{req.estCost.toLocaleString()}</p>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${req.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {req.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}