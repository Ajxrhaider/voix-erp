import React, { useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { BarChart3, TrendingUp, Network, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Management() {
  const { ledger, sales, deployments, customers } = useContext(AppContext);

  const kpis = useMemo(() => {
    const grossIncome = ledger.filter(l => l.type === 'Income').reduce((sum, l) => sum + (l.gross_amount || 0), 0);
    const expenses = ledger.filter(l => l.type === 'Expense').reduce((sum, l) => sum + (l.gross_amount || 0), 0);
    const pipeline = sales.filter(s => s.stage !== 'Closing/Won' && s.stage !== 'Lost').reduce((sum, s) => sum + (s.amount || 0), 0);
    
    return [
      { title: "Gross Revenue", value: `₦${grossIncome.toLocaleString(undefined, {maximumFractionDigits: 0})}`, colorClass: "text-emerald-600" },
      { title: "Total OPEX / Expenses", value: `₦${expenses.toLocaleString(undefined, {maximumFractionDigits: 0})}`, colorClass: "text-red-600" },
      { title: "Sales Pipeline Value", value: `₦${pipeline.toLocaleString(undefined, {maximumFractionDigits: 0})}`, colorClass: "text-amber-600" },
      { title: "Total Subscriber Base", value: customers.length, colorClass: "text-blue-600" }
    ];
  }, [ledger, sales, customers]);

  return (
    <ModuleLayout
      title="Executive Management"
      subtitle="Corporate oversight, revenue tracking, and operational health"
      icon={<BarChart3 className="w-6 h-6" />}
      kpis={kpis}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/accounting" className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-md transition group">
          <div className="bg-emerald-100 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Accounting Ledger</h3>
          <p className="text-sm text-slate-500 mt-1">Review FIRS 7.5% VAT, Income Day Book, and Expense reports.</p>
        </Link>

        <Link to="/sales" className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-md transition group">
          <div className="bg-amber-100 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-4 group-hover:bg-amber-600 group-hover:text-white transition">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Commercial Pipeline</h3>
          <p className="text-sm text-slate-500 mt-1">Oversee Bitrix24 deal progression and sales performance.</p>
        </Link>

        <Link to="/deployments" className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-md transition group">
          <div className="bg-blue-100 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition">
            <Network className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Deployments Tracker</h3>
          <p className="text-sm text-slate-500 mt-1">Monitor live fiber installations and provisioning metrics.</p>
        </Link>
      </div>
    </ModuleLayout>
  );
}