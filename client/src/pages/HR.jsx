import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Users, UserPlus, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const AVAILABLE_ROLES = ['GM', 'Management', 'HR', 'Accounting', 'HOD NOC', 'NOC', 'HOD Fiber', 'Fiber', 'Customer Service', 'Sales', 'Inventory', 'Dev', 'Admin'];

export default function HR() {
  const { staff, authFetch, refreshSystemData, hasRole } = useContext(AppContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ fullname: '', username: '', email: '', password: '', roles: [], department: 'Commercial' });
  const [editingRolesFor, setEditingRolesFor] = useState(null);

  const kpis = useMemo(() => [
    { title: "Total Staff", value: staff.length, color: "text-slate-900" },
    { title: "Active Personnel", value: staff.filter(s => s.is_active).length, color: "text-emerald-600" },
    { title: "Field Technicians", value: staff.filter(s => s.roles?.includes('Fiber')).length, color: "text-amber-600" },
    { title: "Management", value: staff.filter(s => s.roles?.includes('Management') || s.roles?.includes('GM')).length, color: "text-purple-600" }
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
          <div className="bg-voix-600 p-2.5 rounded-lg"><Users className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">Human Resources</h1>
            <p className="text-xs text-slate-400">Manage directory, EMP IDs, and system role access</p>
          </div>
        </div>
        <div className="flex gap-2">
          {hasRole(['HR', 'Management', 'GM']) && (
            <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
              <UserPlus className="w-4 h-4"/> Add Staff
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.title} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase">{k.title}</p>
            <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-3">Staff ID</th>
              <th className="p-3">Name & Email</th>
              <th className="p-3">Assigned Roles</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.map(s => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="p-3 font-mono font-bold text-voix-600">{s.id}</td>
                <td className="p-3">
                  <p className="font-bold text-slate-900">{s.fullname}</p>
                  <p className="text-xs text-slate-500">{s.email}</p>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {(s.roles || []).map(r => <span key={r} className="px-2 py-0.5 bg-slate-100 border text-[10px] font-bold rounded">{r}</span>)}
                  </div>
                </td>
                <td className="p-3 text-right">
                  {hasRole(['HR', 'Management', 'GM']) && (
                    <button onClick={() => setEditingRolesFor(s)} className="text-xs font-bold text-blue-600 border border-blue-200 px-2 py-1 rounded">Edit Roles</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role Assignment Modal */}
      {editingRolesFor && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Edit Roles for {editingRolesFor.fullname}</h3>
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border h-48 overflow-y-auto">
              {AVAILABLE_ROLES.map(role => (
                <label key={role} className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input type="checkbox" checked={(editingRolesFor.roles || []).includes(role)}
                    onChange={() => {
                      const roles = editingRolesFor.roles || [];
                      setEditingRolesFor({ ...editingRolesFor, roles: roles.includes(role) ? roles.filter(r => r !== role) : [...roles, role] });
                    }} className="rounded text-emerald-600" /> {role}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button onClick={() => setEditingRolesFor(null)} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={() => saveRoles(editingRolesFor.id)} className="px-4 py-2 bg-voix-600 text-white rounded font-bold">Save Roles</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Register New Staff</h3>
            <form onSubmit={handleRegister} className="space-y-3">
              <input type="text" required placeholder="Full Name" onChange={e => setFormData({...formData, fullname: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <input type="text" required placeholder="Username" onChange={e => setFormData({...formData, username: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <input type="email" required placeholder="Email Address" onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border p-2 rounded text-sm" />
              <input type="password" required placeholder="Password" onChange={e => setFormData({...formData, password: e.target.value})} className="w-full border p-2 rounded text-sm" />
              
              <div className="pt-2">
                <label className="text-xs font-bold text-slate-600 block mb-2">Assign Operational Roles</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border h-32 overflow-y-auto">
                  {AVAILABLE_ROLES.map(role => (
                    <label key={role} className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input type="checkbox" checked={formData.roles.includes(role)} onChange={() => toggleRole(role)} className="rounded text-emerald-600" /> {role}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-bold">Generate EMP ID</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}