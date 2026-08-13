// client/src/components/FiberReportForm.jsx
import React, { useState } from 'react';
import { Save, Clock, MapPin } from 'lucide-react';

export default function FiberReportForm({ workOrderId, onSubmitReport }) {
  const [formData, setFormData] = useState({
    time_arrived: '',
    ticket_id: '',
    splicer_responsible: '',
    closure_location: '',
    failure_point: '',
    manipulations: '',
    route_segment: '',
    otdr_distance: ''
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmitReport(workOrderId, formData);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-xl font-bold mb-1 text-slate-800">Daily Fiber Restoration & Splicing Report</h3>
      <p className="text-sm text-slate-500 mb-6">Complete all fields to close the active work order.</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Time Arrived</label>
            <div className="relative">
              <Clock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input type="time" name="time_arrived" onChange={handleChange} className="w-full pl-9 pr-3 py-2 border rounded-lg" required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Splicer Responsible</label>
            {/* Note: Capturing the specific technician ensures accountability for splice quality[cite: 6]. */}
            <input type="text" name="splicer_responsible" onChange={handleChange} placeholder="Specific technician name" className="w-full px-3 py-2 border rounded-lg" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Closure Location & Name / GPS</label>
            {/* Note: Requires specific identifiers like Manhole ID or precise intersection[cite: 6]. */}
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input type="text" name="closure_location" onChange={handleChange} placeholder="e.g. Manhole 12, Wuse Zone 5" className="w-full pl-9 pr-3 py-2 border rounded-lg" required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">OTDR Distance to Cut</label>
            <input type="text" name="otdr_distance" onChange={handleChange} placeholder="e.g. 1,452m" className="w-full px-3 py-2 border rounded-lg" required />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Route Segment</label>
          {/* Note: Must trace known route from OTDR distance to find physical location[cite: 6]. */}
          <input type="text" name="route_segment" onChange={handleChange} placeholder="e.g. Node A to Wuse Hub" className="w-full px-3 py-2 border rounded-lg" required />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Failure Point Description</label>
          <input type="text" name="failure_point" onChange={handleChange} placeholder="e.g. Total fiber cut" className="w-full px-3 py-2 border rounded-lg" required />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Manipulations & Changes Made</label>
          {/* Note: Requires exact details, vague entries are rejected[cite: 6]. */}
          <textarea name="manipulations" onChange={handleChange} rows="3" placeholder="e.g. Spliced cores 1-12; replaced damaged tray" className="w-full px-3 py-2 border rounded-lg" required></textarea>
        </div>

        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
          <Save className="w-5 h-5" /> Submit Daily Report & Close Order
        </button>
      </form>
    </div>
  );
}