import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Sidebar() {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/' },
    { name: 'Subscribers', path: '/customers' }, // Replaced "Customer CRM Desk"
    { name: 'Sales Tracker', path: '/sales' }, // Replaced "Sales Pipeline Engine"
    { name: 'Fiber Installations', path: '/deployments' }, // Replaced "Deployments Layer"
    { name: 'Work Orders', path: '/tickets' },
    { name: 'Field Crews', path: '/teams' }, // Replaced "Dynamic Field Teams"
    { name: 'Inventory', path: '/inventory' },
    { name: 'Staff Directory', path: '/staff' }
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 min-h-screen flex flex-col hidden md:flex">
      {/* BRANDING HEADER */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 bg-voix-600 rounded-lg flex items-center justify-center p-1 shadow-md shadow-voix-600/20 group-hover:bg-voix-500 transition-colors">
            <img src="/voix-logo.png" alt="Voix Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-white font-bold text-lg tracking-wide">
            Voix <span className="text-voix-500">ERP</span>
          </span>
        </Link>
      </div>

      {/* NAVIGATION LINKS */}
      <nav className="flex-1 py-6 px-3 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-voix-500/10 text-voix-500' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}