import React, { useState, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { Truck, Fuel, Wrench, Plus } from 'lucide-react';

export default function FleetModule() {
  const { vehicles } = useContext(AppContext);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center">
            <Truck className="w-5 h-5 mr-2 text-indigo-600" /> Fleet & Vehicle Dispatch
          </h2>
          <p className="text-sm text-slate-500">Track Hilux trucks, vans, and maintenance schedules</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-3 py-2 rounded text-sm font-medium flex items-center">
          <Plus className="w-4 h-4 mr-1" /> Add Vehicle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.map(veh => (
          <div key={veh.id} className="border border-slate-200 p-4 rounded-lg bg-slate-50 relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <span className="font-bold text-slate-800 text-lg">{veh.plateNumber}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${veh.status === 'Available' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {veh.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4 font-mono">{veh.model}</p>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center text-slate-600"><Fuel className="w-4 h-4 mr-1 text-slate-400" /> {veh.fuelLevel}%</span>
              <span className="flex items-center text-slate-600"><Wrench className="w-4 h-4 mr-1 text-slate-400" /> {veh.lastMaintenance}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}