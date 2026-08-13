import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import SalesDashboard from '../components/SalesDashboard';
import { UserPlus, ShieldAlert, Layers, Users } from 'lucide-react';

export default function Dashboard() {
  // Removed 'logout' from context extraction since the Header now handles it
  const { user, staff, authFetch } = useContext(AppContext);
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFullname, setRegFullname] = useState('');
  const [regRole, setRegRole] = useState('Sales');
  const [statusMsg, setStatusMsg] = useState('');

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-red-500" />
        <h1 className="text-xl font-bold text-slate-800">Session Expired</h1>
        <p className="text-sm text-slate-500">Please log in again to access the dashboard.</p>
      </div>
    );
  }

  const handleRegisterStaff = async (e) => {
    e.preventDefault();
    setStatusMsg('');
    const res = await authFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: regUsername, password: regPassword, fullname: regFullname, role: regRole })
    });
    if (res.ok) {
      const data = await res.json();
      setStatusMsg(`Success: Account created for ${data.employeeId}`);
      setRegUsername(''); setRegPassword(''); setRegFullname('');
    } else {
      setStatusMsg('Failed: Username may already exist.');
    }
  };

  const handleRoleChange = async (staffId, targetRole) => {
    await authFetch('/api/hr/staff/role', {
      method: 'PUT',
      body: JSON.stringify({ targetStaffId: staffId, newRole: targetRole })
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Role-Based Dashboard View */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        {user.role === 'Sales' || user.role === 'GM' || user.role === 'Management' ? (
          <SalesDashboard />
        ) : (
          <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
            <Layers className="w-8 h-8 text-voix-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-800">Welcome to Voix ERP</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
              Select an option from the sidebar to view your assignments, manage subscribers, or check inventory.
            </p>
          </div>
        )}
      </section>

      {/* Administration Panel (HR, GM, Management Only) */}
      {(user.role === 'HR' || user.role === 'GM' || user.role === 'Management') && (
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 pt-6 border-t border-slate-200">
          
          {/* Add New Staff Form */}
          <div className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
              <div className="p-2 bg-voix-50 rounded-lg">
                <UserPlus className="w-5 h-5 text-voix-600" />
              </div>
              <h2 className="text-base font-semibold text-slate-800">Add New Staff</h2>
            </div>
            
            <form onSubmit={handleRegisterStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Full Name</label>
                <input type="text" required value={regFullname} onChange={e => setRegFullname(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-voix-500 focus:ring-1 focus:ring-voix-500 transition-colors text-sm" placeholder="e.g. John Doe" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Username</label>
                <input type="text" required value={regUsername} onChange={e => setRegUsername(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-voix-500 focus:ring-1 focus:ring-voix-500 transition-colors text-sm" placeholder="e.g. j.doe" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Password</label>
                <input type="password" required value={regPassword} onChange={e => setRegPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-voix-500 focus:ring-1 focus:ring-voix-500 transition-colors text-sm" placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Department / Role</label>
                <select value={regRole} onChange={e => setRegRole(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-voix-500 focus:ring-1 focus:ring-voix-500 transition-colors text-sm">
                  <option value="Sales">Sales</option>
                  <option value="NOC">NOC</option>
                  <option value="Fiber">Fiber Crew</option>
                  <option value="Customer Service">Customer Service</option>
                  <option value="Accounting">Accounting</option>
                  <option value="HR">Human Resources</option>
                  <option value="GM">General Manager</option>
                  <option value="Management">Management</option>
                </select>
              </div>
              <button type="submit" className="w-full py-2.5 bg-voix-600 hover:bg-voix-700 text-white font-semibold rounded-lg shadow-md transition-colors text-sm">
                Create Account
              </button>
              {statusMsg && (
                <p className={`p-3 text-center rounded-lg text-xs font-medium ${statusMsg.includes('Success') ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                  {statusMsg}
                </p>
              )}
            </form>
          </div>

          {/* Staff Directory Table */}
          <div className="xl:col-span-8 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
              <div className="p-2 bg-voix-50 rounded-lg">
                <Users className="w-5 h-5 text-voix-600" />
              </div>
              <h2 className="text-base font-semibold text-slate-800">Staff Directory</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Staff ID</th>
                    <th className="pb-3 font-semibold">Full Name</th>
                    <th className="pb-3 font-semibold">Username</th>
                    <th className="pb-3 font-semibold">Department</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {staff.map(member => (
                    <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 font-medium text-voix-600">{member.id}</td>
                      <td className="py-3 text-slate-800 font-medium">{member.fullname}</td>
                      <td className="py-3 text-slate-500">{member.username}</td>
                      <td className="py-3">
                        <select 
                          value={member.role} 
                          onChange={e => handleRoleChange(member.id, e.target.value)} 
                          className="bg-slate-50 border border-slate-200 rounded-md p-1.5 text-xs text-slate-700 focus:outline-none focus:border-voix-500 focus:ring-1 focus:ring-voix-500 cursor-pointer"
                        >
                          <option value="Sales">Sales</option>
                          <option value="NOC">NOC</option>
                          <option value="Fiber">Fiber Crew</option>
                          <option value="Customer Service">Customer Service</option>
                          <option value="Accounting">Accounting</option>
                          <option value="HR">HR</option>
                          <option value="GM">GM</option>
                          <option value="Management">Management</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}