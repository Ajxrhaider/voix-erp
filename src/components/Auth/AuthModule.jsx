import React, { useState, useContext } from 'react';
import { AppContext } from '../../context/AppContext'; // Fixed relative directory jump

export default function AuthModule() {
  const { loginUser } = useContext(AppContext);
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullname, setFullname] = useState('');
  const [role, setRole] = useState('noc');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? '/api/login' : '/api/register';
    const payload = isLogin ? { username, password } : { username, password, fullname, role };

    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      if (isLogin) loginUser(data.token);
      else { alert('Registered!'); setIsLogin(true); }
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-900">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-6 text-center text-slate-800">
          {isLogin ? 'Voix ERP Login' : 'Create Enterprise Account'}
        </h2>
        {error && <div className="text-xs bg-red-50 text-red-600 p-2.5 rounded-lg mb-4 font-medium border border-red-100">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Full Name</label>
                <input type="text" placeholder="Full Name" required onChange={e => setFullname(e.target.value)} className="w-full border border-slate-300 p-2 rounded text-sm outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Assign Department Role</label>
                <select value={role} onChange={e => setRole(e.target.value)} className="w-full border border-slate-300 p-2 rounded text-sm bg-white outline-none">
                  <option value="dev">Developer (All Access)</option>
                  <option value="management">Management / GM</option>
                  <option value="account">Accounting & HR</option>
                  <option value="sales">Sales & Marketing</option>
                  <option value="noc">NOC (Network Ops)</option>
                  <option value="fiber">Fiber Field Crew</option>
                </select>
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Username</label>
            <input type="text" placeholder="Username" required onChange={e => setUsername(e.target.value)} className="w-full border border-slate-300 p-2 rounded text-sm outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Password</label>
            <input type="password" placeholder="Password" required onChange={e => setPassword(e.target.value)} className="w-full border border-slate-300 p-2 rounded text-sm outline-none" />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white font-medium py-2 rounded text-sm hover:bg-blue-700 transition-colors">{isLogin ? 'Login' : 'Register'}</button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="w-full mt-4 text-xs font-medium text-blue-600 hover:underline">
          {isLogin ? 'Create new user role account' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}