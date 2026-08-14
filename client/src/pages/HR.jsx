import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Users, UserPlus, Shield, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function HR() {
  const { staff, authFetch, refreshSystemData, user } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('directory');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullname: '', username: '', email: '', phone: '', password: '', role: 'Sales', department: 'Commercial'
  });

  const kpis = useMemo(() => [
    { title: "Total Staff", value: staff.length, color: "text-slate-900" },
    { title: "Active Personnel", value: staff.filter(s => s.is_active).length, color: "text-emerald-600" },
    { title: "Field Technicians", value: staff.filter(s => s.role === 'Fiber').length, color: "text-amber-600" },
    { title: "Management & GM", value: staff.filter(s => s.role === 'Management' || s.role === 'GM').length, color: "text-purple-600" }
  ], [staff]);

  const filteredStaff = useMemo(() => {
    return staff.filter(s => 
      s.fullname.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [staff, searchQuery]);

  const handleRegister = async (e) => {
    e.preventDefault();
    const res = await authFetch('/api/auth/staff', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    if (res.ok) {
      setIsModalOpen(false);
      refreshSystemData();
      setFormData({ fullname: '', username: '', email: '', phone: '', password: '', role: 'Sales', department: 'Commercial' });
    } else {
      const err = await res.json();
      alert(`Registration failed: ${err.message}`);
    }
  };

  const handleRoleChange = async (id, newRole) => {
    await authFetch(`/api/auth/staff/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role: newRole })
    });
    refreshSystemData();
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredStaff.map(s => ({
      "Staff ID": s.id, "Full Name": s.fullname, "Username": s.username, 
      "Email": s.email, "Role": s.role, "Department": s.department
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff Directory");
    XLSX.writeFile(wb, "Voix_Staff_Directory.xlsx");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Gold-Standard Header */}
      <header className="bg-slate-900 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="bg-voix-600 p-2.5 rounded-lg"><Users className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">Human Resources <span className="text-xs bg-voix-500/30 text-voix-300 px-2.5 py-0.5 rounded-full">Staff Control</span></h1>
            <p className="text-xs text-slate-400">Manage directory, EMP IDs, and system role access</p>
          </div>
        </div>
        <div className="flex gap-2">
          {['HR', 'GM', 'Management'].includes(user?.role) && (
            <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
              <UserPlus className="w-4 h-4"/> Add Staff
            </button>
          )}
          <button onClick={exportExcel} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
            <Download className="w-4 h-4"/> Export
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.title} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase">{k.title}</p>
            <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between">
        <input type="text" placeholder="Search by name or EMP-ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="px-3 py-2 text-sm border rounded-lg w-72" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-3">Staff ID</th>
              <th className="p-3">Name & Email</th>
              <th className="p-3">Department</th>
              <th className="p-3">System Role</th>
              <th className="p-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStaff.map(s => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="p-3 font-mono font-bold text-voix-600">{s.id}</td>
                <td className="p-3">
                  <p className="font-bold text-slate-900">{s.fullname}</p>
                  <p className="text-xs text-slate-500">{s.email}</p>
                </td>
                <td className="p-3 text-slate-600">{s.department}</td>
                <td className="p-3">
                  {['HR', 'GM', 'Management'].includes(user?.role) ? (
                    <select value={s.role} onChange={e => handleRoleChange(s.id, e.target.value)} className="border rounded px-2 py-1 text-xs font-bold">
                      {['Sales', 'NOC', 'Fiber', 'Customer Service', 'Accounting', 'Inventory', 'HR', 'GM', 'Management', 'Dev'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span className="font-bold text-slate-700">{s.role}</span>
                  )}
                </td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${s.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {s.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Register New Staff</h3>
            <form onSubmit={handleRegister} className="space-y-3">
              <input type="text" required placeholder="Full Name" value={formData.fullname} onChange={e => setFormData({...formData, fullname: e.target.value})} className="w-full border p-2 rounded" />
              <input type="text" required placeholder="Username" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full border p-2 rounded" />
              <input type="email" required placeholder="Email Address" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border p-2 rounded" />
              <input type="password" required placeholder="Password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full border p-2 rounded" />
              <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full border p-2 rounded">
                <option value="Sales">Sales</option>
                <option value="Fiber">Fiber (Field Tech)</option>
                <option value="NOC">NOC Engineer</option>
                <option value="Customer Service">Customer Service</option>
                <option value="Accounting">Accounting</option>
                <option value="Inventory">Inventory</option>
              </select>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-voix-600 text-white rounded font-bold">Generate EMP ID</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}