import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Users, UserPlus } from 'lucide-react';

const AVAILABLE_ROLES = ['GM', 'Management', 'HR', 'Accounting', 'HOD NOC', 'NOC', 'HOD Fiber', 'Fiber', 'Customer Service', 'Sales', 'Inventory', 'Dev', 'Admin'];

export default function HR() {
  const { staff, authFetch, refreshSystemData, hasRole } = useContext(AppContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ fullname: '', username: '', email: '', password: '', roles: [], department: 'Commercial' });
  const [editingRolesFor, setEditingRolesFor] = useState(null);

  const kpis = useMemo(() => [
    { title: "Total Staff", value: staff.length, color: "text-slate-900" },
    { title: "Active Personnel", value: staff.filter(s => s.is_active).length, color: "text-emerald-700" },
    { title: "Field Technicians", value: staff.filter(s => s.roles?.includes('Fiber')).length, color: "text-amber-700" },
    { title: "Management", value: staff.filter(s => s.roles?.includes('Management') || s.roles?.includes('GM')).length, color: "text-purple-700" }
  ], [staff]);

  const toggleRole = (role) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role) ? prev.roles.filter(r => r !== role) : [...prev.roles, role]
    }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (formData.roles.length === 0) return alert("Select at least one role.");
    const res = await authFetch('/api/auth/staff', { method: 'POST', body: JSON.stringify(formData) });
    if (res.ok) {
      setIsModalOpen(false);
      refreshSystemData();
      setFormData({ fullname: '', username: '', email: '', password: '', roles: [], department: 'Commercial' });
    } else {
      alert((await res.json()).message);
    }
  };

  const saveRoles = async (id) => {
    await authFetch(`/api/auth/staff/${id}/role`, { method: 'PATCH', body: JSON.stringify({ roles: editingRolesFor.roles }) });
    setEditingRolesFor(null);
    refreshSystemData();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <header className="bg-slate-900 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-600 p-2.5 rounded-lg"><Users className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">Human Resources</h1>
            <p className="text-xs text-slate-400">Manage directory, EMP IDs, and system role access</p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {hasRole(['HR', 'Management', 'GM', 'Dev']) && (
            <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 md:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 w-full md:w-auto shadow-sm transition">
              <UserPlus className="w-4 h-4"/> Add Staff
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.title} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{k.title}</p>
            <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto custom-scrollbar w-full">
        <table className="w-full text-left text-sm min-w-[700px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-3 text-slate-900 font-bold">Staff ID</th>
              <th className="p-3 text-slate-900 font-bold">Name & Email</th>
              <th className="p-3 text-slate-900 font-bold">Assigned Roles</th>
              <th className="p-3 text-right text-slate-900 font-bold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.map(s => (
              <tr key={s.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-mono font-bold text-slate-600 whitespace-nowrap">{s.id}</td>
                <td className="p-3">
                  <p className="font-bold text-slate-900">{s.fullname}</p>
                  <p className="text-xs text-slate-600">{s.email}</p>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {(s.roles || []).map(r => <span key={r} className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-800 rounded shadow-sm">{r}</span>)}
                  </div>
                </td>
                <td className="p-3 text-right">
                  {hasRole(['HR', 'Management', 'GM', 'Dev']) && (
                    <button onClick={() => setEditingRolesFor(s)} className="text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-300 px-3 py-1.5 rounded transition shadow-sm">Edit Roles</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role Assignment Modal */}
      {editingRolesFor && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <h3 className="font-bold text-lg mb-4 text-slate-900 border-b border-slate-200 pb-2">Edit Roles for {editingRolesFor.fullname}</h3>
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-300 h-48 overflow-y-auto custom-scrollbar">
              {AVAILABLE_ROLES.map(role => (
                <label key={role} className="flex items-center gap-2 text-[11px] sm:text-xs font-bold text-slate-900 cursor-pointer">
                  <input type="checkbox" checked={(editingRolesFor.roles || []).includes(role)}
                    onChange={() => {
                      const roles = editingRolesFor.roles || [];
                      setEditingRolesFor({ ...editingRolesFor, roles: roles.includes(role) ? roles.filter(r => r !== role) : [...roles, role] });
                    }} className="rounded text-emerald-600 border-slate-400 w-4 h-4" /> {role}
                </label>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200 mt-4">
              <button onClick={() => setEditingRolesFor(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold px-4 py-2.5 sm:py-2 rounded-lg text-sm w-full sm:w-auto transition shadow-sm">Cancel</button>
              <button onClick={() => saveRoles(editingRolesFor.id)} className="px-4 py-2.5 sm:py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-sm w-full sm:w-auto transition shadow-sm">Save Roles</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[95%] sm:w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <h3 className="font-bold text-lg mb-4 border-b border-slate-200 pb-2 text-slate-900">Register New Staff</h3>
            <form onSubmit={handleRegister} className="space-y-4">
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Full Name</label><input type="text" required placeholder="Full Name" onChange={e => setFormData({...formData, fullname: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Username</label><input type="text" required placeholder="Username" onChange={e => setFormData({...formData, username: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Email Address</label><input type="email" placeholder="Email Address" onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              <div><label className="text-[10px] font-bold block mb-1 text-slate-900">Password</label><input type="password" required placeholder="Password" onChange={e => setFormData({...formData, password: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-slate-50 text-slate-900 placeholder-slate-400" /></div>
              
              <div className="pt-2">
                <label className="text-[11px] sm:text-xs font-bold text-slate-900 block mb-2">Assign Operational Roles</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-300 h-32 overflow-y-auto custom-scrollbar">
                  {AVAILABLE_ROLES.map(role => (
                    <label key={role} className="flex items-center gap-2 text-[11px] sm:text-xs font-bold text-slate-900 cursor-pointer">
                      <input type="checkbox" checked={formData.roles.includes(role)} onChange={() => toggleRole(role)} className="rounded text-emerald-600 border-slate-400 w-4 h-4" /> {role}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold px-4 py-2.5 sm:py-2 rounded-lg text-sm w-full sm:w-auto transition shadow-sm">Cancel</button>
                <button type="submit" className="px-4 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm shadow-sm w-full sm:w-auto transition">Generate EMP ID</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}