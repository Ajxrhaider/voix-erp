import React, { useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user, customers, sales, deployments, tickets, workOrders, inventory, ledger, requisitions } = useContext(AppContext);

  const kpis = useMemo(() => {
    return {
      activeSubscribers: (customers || []).filter(c => c.status === 'Active').length,
      openTickets: (tickets || []).filter(t => t.status === 'Open' || t.status === 'In Progress').length,
      pendingDeployments: (deployments || []).filter(d => d.status !== 'Completed' && d.status !== 'Cancelled').length,
      activePipelineValue: (sales || []).filter(s => s.stage !== 'Closing/Won' && s.stage !== 'Lost').reduce((sum, s) => sum + (s.amount || 0), 0),
      grossIncome: (ledger || []).filter(l => l.type === 'Income').reduce((sum, l) => sum + (l.gross_amount || 0), 0),
    };
  }, [customers, tickets, deployments, sales, ledger]);

  const renderRoleDashboard = () => {
    switch (user?.role) {
      case 'Fiber':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase">Assigned Work Orders</p>
              <p className="text-3xl font-black text-amber-600 mt-2">
                {(workOrders || []).filter(w => w.status !== 'Fulfilled' && w.status !== 'Closed').length}
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase">Deployments In Queue</p>
              <p className="text-3xl font-black text-blue-600 mt-2">{kpis.pendingDeployments}</p>
            </div>
          </div>
        );

      case 'NOC':
      case 'Customer Service':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase">Active Queries</p>
              <p className="text-3xl font-black text-red-600 mt-2">{kpis.openTickets}</p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase">Total Subscribers</p>
              <p className="text-3xl font-black text-slate-900 mt-2">{kpis.activeSubscribers}</p>
            </div>
          </div>
        );

      case 'Sales':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase">Pipeline Value</p>
              <p className="text-3xl font-black text-slate-900 mt-2">₦{kpis.activePipelineValue.toLocaleString()}</p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase">Won Deals</p>
              <p className="text-3xl font-black text-emerald-600 mt-2">
                {(sales || []).filter(s => s.stage === 'Closing/Won').length}
              </p>
            </div>
          </div>
        );

      default: // GM, Accounting, Management, HR
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase">Gross Revenue Received</p>
              <p className="text-2xl font-black text-slate-900 mt-1">₦{kpis.grossIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              <p className="text-xs text-emerald-600 font-semibold mt-1">● Active Day Book Flow</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase">Active Subscribers</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{kpis.activeSubscribers}</p>
              <p className="text-xs text-slate-400 mt-1">FTTH & Enterprise Clients</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase">Open NOC / Fiber Tickets</p>
              <p className="text-2xl font-black text-red-600 mt-1">{kpis.openTickets}</p>
              <p className="text-xs text-slate-400 mt-1">{kpis.pendingDeployments} Pending Installations</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white">Welcome back, {user?.fullname}</h1>
            <span className="px-3 py-0.5 rounded-full text-xs font-extrabold bg-voix-500 text-white shadow-sm">
              {user?.role} Portal
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Staff ID: <span className="font-mono text-slate-200">{user?.id}</span></p>
        </div>
      </div>
      {renderRoleDashboard()}
    </div>
  );
}