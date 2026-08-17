import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user, customers, sales, deployments, tickets, workOrders, ledger, hasRole } = useContext(AppContext);

  const kpis = {
    activeSubscribers: (customers || []).filter(c => c.status === 'Active').length,
    openTickets: (tickets || []).filter(t => t.status === 'Open').length,
    pendingDeployments: (deployments || []).filter(d => d.status !== 'Completed').length,
    pipelineValue: (sales || []).filter(s => s.stage !== 'Closing/Won' && s.stage !== 'Lost').reduce((sum, s) => sum + (s.amount || 0), 0),
    grossIncome: (ledger || []).filter(l => l.type === 'Income').reduce((sum, l) => sum + (l.gross_amount || 0), 0),
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user?.fullname}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            {(user?.roles || []).map(r => (
              <span key={r} className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 uppercase">
                {r}
              </span>
            ))}
          </div>
        </div>
        <Link to="/profile" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-200 transition border border-slate-600">
          Account Profile
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6">
        
        {/* Executive Widget */}
        {hasRole(['GM', 'Management', 'HR', 'Accounting', 'Sales']) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-emerald-500">
              <p className="text-xs font-bold text-slate-500 uppercase">Gross Revenue</p>
              <p className="text-2xl font-black text-slate-900 mt-1">₦{kpis.grossIncome.toLocaleString()}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-blue-500">
              <p className="text-xs font-bold text-slate-500 uppercase">Subscribers</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{kpis.activeSubscribers}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-amber-500">
              <p className="text-xs font-bold text-slate-500 uppercase">Sales Pipeline</p>
              <p className="text-2xl font-black text-slate-900 mt-1">₦{kpis.pipelineValue.toLocaleString()}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-red-500">
              <p className="text-xs font-bold text-slate-500 uppercase">Pending Installs</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{kpis.pendingDeployments}</p>
            </div>
          </div>
        )}

        {/* Technical Support Widget */}
        {hasRole(['HOD NOC', 'NOC', 'Customer Service']) && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-lg text-slate-900 mb-4 border-b pb-2">Network & Support Operations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-lg border">
                <p className="text-xs font-bold text-slate-500 uppercase">Active Queries</p>
                <p className="text-3xl font-black text-red-600 mt-2">{kpis.openTickets}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border">
                <p className="text-xs font-bold text-slate-500 uppercase">Field Work Orders</p>
                <p className="text-3xl font-black text-amber-600 mt-2">
                  {(workOrders || []).filter(w => w.status !== 'Closed').length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Fiber Field Widget */}
        {hasRole(['HOD Fiber', 'Fiber']) && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-lg text-slate-900 mb-4 border-b pb-2">My Field Assignments</h3>
            <div className="space-y-2">
              {(workOrders || []).filter(w => w.status === 'Assigned' || w.status === 'On Site').length === 0 ? (
                <p className="text-sm text-slate-500">No active splicing jobs assigned to your team today.</p>
              ) : (
                (workOrders || []).filter(w => w.status === 'Assigned' || w.status === 'On Site').slice(0,5).map(wo => (
                  <div key={wo.id} className="p-3 bg-slate-50 rounded-lg border flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-900">{wo.objective}</p>
                      <p className="text-xs text-slate-500">{wo.location}</p>
                    </div>
                    <Link to="/work-orders" className="text-xs font-bold bg-amber-600 text-white px-3 py-1.5 rounded">View Order</Link>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}