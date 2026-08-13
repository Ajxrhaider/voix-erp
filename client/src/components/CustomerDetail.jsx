import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { User, CreditCard, Ticket, Clock, CheckCircle } from 'lucide-react';

export default function CustomerDetail({ customerId }) {
  const { customers, tickets, ledger } = useContext(AppContext);
  const customer = customers.find(c => c.id === customerId);
  const customerTickets = tickets.filter(t => t.customer_id === customerId);
  const customerPayments = ledger.filter(l => l.reference_id === customerId);

  if (!customer) return <div className="text-slate-500">Record not found.</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Profile Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex justify-between items-start">
        <div className="flex gap-4">
          <div className="h-16 w-16 bg-slate-800 rounded-full flex items-center justify-center">
            <User className="text-teal-400 w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">{customer.name}</h2>
            <p className="text-slate-400 font-mono text-xs">{customer.id} • {customer.email}</p>
            <div className="mt-2 flex gap-2">
              <span className="px-2 py-0.5 rounded bg-teal-900/30 text-teal-400 text-[10px] font-bold border border-teal-800">{customer.plan}</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold border border-slate-700">{customer.status}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-slate-500 text-[10px] uppercase font-bold">Current Balance</p>
          <p className="text-2xl font-black text-white">₦{customer.balance?.toLocaleString()}</p>
        </div>
      </div>

      {/* Grid: Tickets & Financials */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ticket History */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-sm">
            <Ticket className="w-4 h-4 text-rose-400" /> Service Query History
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {customerTickets.map(t => (
              <div key={t.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-white">{t.title}</p>
                  <p className="text-[9px] text-slate-500 font-mono">{t.created_at.slice(0,10)}</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${t.status === 'Resolved' ? 'bg-teal-900/30 text-teal-400' : 'bg-rose-900/30 text-rose-400'}`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment History */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-sm">
            <CreditCard className="w-4 h-4 text-emerald-400" /> Financial Records
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {customerPayments.map(p => (
              <div key={p.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                <p className="text-xs font-medium text-slate-300">Subscription Payment</p>
                <p className="text-xs font-bold text-emerald-400">+₦{p.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}