import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

export default function Header() {
  const { user, logout } = useContext(AppContext);

  // Fallback display if user object is not yet populated
  const displayUser = user || { username: 'Staff', role: 'User' };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center">
        <h2 className="text-lg font-semibold text-slate-800 hidden sm:block">
          Portal Overview
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-slate-700">{displayUser.username}</p>
          <p className="text-xs text-voix-600 font-semibold">{displayUser.role}</p>
        </div>
        <button 
          onClick={logout}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
        >
          Logout
        </button>
      </div>
    </header>
  );
}