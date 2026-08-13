import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';

const BACKEND_ENDPOINT = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Login() {
  // Changed state variable from email to username to align with database fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AppContext) || {};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch(`${BACKEND_ENDPOINT}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      if (login) {
        login(data.token, data.user);
      }
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-voix-600 rounded-2xl flex items-center justify-center mx-auto mb-4 p-2 shadow-lg shadow-voix-600/30">
            <img src="/voix-logo.png" alt="Voix Network" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Voix ERP Portal</h1>
          <p className="text-slate-400 text-sm mt-1">Enterprise Operations & Management</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-voix-600 focus:ring-1 focus:ring-voix-600 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-voix-600 focus:ring-1 focus:ring-voix-600 transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-voix-600 hover:bg-voix-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-voix-600/25 active:scale-[0.98]"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}