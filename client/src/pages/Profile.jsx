import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import ModuleLayout from '../components/layout/ModuleLayout';
import { UserCircle, Shield, Key } from 'lucide-react';

export default function Profile() {
  const { user, authFetch, login, token } = useContext(AppContext);
  const [profileData, setProfileData] = useState({ fullname: '', email: '', phone: '' });
  const [passData, setPassData] = useState({ currentPassword: '', newPassword: '' });

  useEffect(() => {
    if (user) setProfileData({ fullname: user.fullname || '', email: user.email || '', phone: user.phone || '' });
  }, [user]);

  const updateProfile = async (e) => {
    e.preventDefault();
    const res = await authFetch('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(profileData) });
    if (res.ok) {
      alert("Profile updated successfully.");
      // Refresh local user state
      const updatedUser = { ...user, ...profileData };
      login(token, updatedUser);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    const res = await authFetch('/api/auth/change-password', { method: 'POST', body: JSON.stringify(passData) });
    if (res.ok) {
      alert("Password changed securely.");
      setPassData({ currentPassword: '', newPassword: '' });
    } else {
      const err = await res.json();
      alert(err.message);
    }
  };

  return (
    <ModuleLayout
      title="My Account Profile"
      subtitle="Manage your personal details and security credentials"
      icon={<UserCircle className="w-6 h-6" />}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Details */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6 border-b pb-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-lg text-slate-900">Personal Information</h3>
          </div>
          
          <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Assigned Roles</p>
            <div className="flex flex-wrap gap-2">
              {(user?.roles || []).map(r => (
                <span key={r} className="px-2.5 py-1 bg-slate-900 text-white rounded text-xs font-bold">{r}</span>
              ))}
            </div>
          </div>

          <form onSubmit={updateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
              <input type="text" value={profileData.fullname} onChange={e => setProfileData({...profileData, fullname: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
              <input type="email" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
              <input type="text" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" />
            </div>
            <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-500 transition w-full">Update Profile</button>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
          <div className="flex items-center gap-2 mb-6 border-b pb-2">
            <Key className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-lg text-slate-900">Change Password</h3>
          </div>
          <form onSubmit={changePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Current Password</label>
              <input type="password" required value={passData.currentPassword} onChange={e => setPassData({...passData, currentPassword: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">New Password</label>
              <input type="password" required value={passData.newPassword} onChange={e => setPassData({...passData, newPassword: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm" />
            </div>
            <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-800 transition w-full mt-2">Secure Account</button>
          </form>
        </div>
      </div>
    </ModuleLayout>
  );
}