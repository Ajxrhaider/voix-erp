import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { TrendingUp } from 'lucide-react';

export default function SalesModule() {
  const { customers } = useContext(AppContext);

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-blue-600" /> Lead Pipeline & Pre-Surveys
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-xs text-blue-600 font-medium uppercase tracking-wider">Total Service Inquiries</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{customers.length}</p>
        </div>
        <div className="p-4 bg-green-50 border border-green-100 rounded-lg">
          <p className="text-xs text-green-600 font-medium uppercase tracking-wider">Survey Closures</p>
          <p className="text-2xl font-bold text-green-900 mt-1">100%</p>
        </div>
        <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg">
          <p className="text-xs text-purple-600 font-medium uppercase tracking-wider">Conversion Health</p>
          <p className="text-2xl font-bold text-purple-900 mt-1">Optimal</p>
        </div>
      </div>
      <p className="text-sm text-slate-500">Sales workflows and fiber visibility telemetry interfaces active.</p>
    </div>
  );
}