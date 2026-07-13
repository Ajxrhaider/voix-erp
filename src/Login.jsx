// src/Login.jsx
import React, { useState } from 'react';

export default function Login({ setToken }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      const { token } = await response.json();
      localStorage.setItem('token', token);
      setToken(token);
    } else {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-slate-950">
      <form onSubmit={handleSubmit} className="bg-slate-900 p-8 rounded-xl border border-slate-800">
        <h2 className="text-white font-bold mb-4">Voix ERP Login</h2>
        {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
        <input 
          type="text" placeholder="Username" className="block w-full mb-2 p-2 bg-slate-950 text-white rounded"
          onChange={(e) => setUsername(e.target.value)}
        />
        <input 
          type="password" placeholder="Password" className="block w-full mb-4 p-2 bg-slate-950 text-white rounded"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="w-full bg-indigo-600 text-white p-2 rounded">Login</button>
      </form>
    </div>
  );
}