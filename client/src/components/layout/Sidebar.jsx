import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';

export default function Sidebar() {
  const location = useLocation();
  const { user } = useContext(AppContext);

  // Grouped Navigation Array mapping all 14 modules to roles
  const allNavItems = [
    { name: 'Dashboard', path: '/', roles: ['All'] },
    
    // Commercial
    { name: 'Sales Pipeline', path: '/sales', roles: ['Sales', 'Management', 'GM'] },
    { name: 'Deployments', path: '/deployments', roles: ['Sales', 'NOC', 'Fiber', 'Management', 'GM'] },
    
    // CRM & Support
    { name: 'CRM Profiles', path: '/customers', roles: ['Customer Service', 'Management', 'GM', 'Accounting'] },
    { name: 'Customer Service', path: '/cs', roles: ['Customer Service', 'Management'] },
    { name: 'NOC Desk', path: '/noc', roles: ['NOC', 'Management', 'GM'] },
    
    // Field Ops
    { name: 'Fiber Teams', path: '/fiber', roles: ['Fiber', 'NOC', 'Management', 'GM'] },
    { name: 'Work Orders', path: '/work-orders', roles: ['Fiber', 'NOC', 'Customer Service', 'Management'] },
    
    // Finance & Assets
    { name: 'Inventory', path: '/inventory', roles: ['Inventory', 'Accounting', 'Management', 'GM'] },
    { name: 'Requisitions', path: '/requisitions', roles: ['All'] }, // Everyone can request
    { name: 'Accounting', path: '/accounting', roles: ['Accounting', 'Management', 'GM'] },
    
    // Administration
    { name: 'HR Directory', path: '/hr', roles: ['HR', 'Management', 'GM'] },
    { name: 'Management', path: '/management', roles: ['Management', 'GM'] },
    { name: 'IT Admin', path: '/admin', roles: ['Dev', 'Management'] },
  ];

  // Filter links based on user role (Management/GM sees almost everything)
  const allowedLinks = allNavItems.filter(item => 
    item.roles.includes('All') || 
    (user && item.roles.includes(user.role)) || 
    (user && user.role === 'Management')
  );

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
      <nav className="flex-1 py-6 px-3 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
        {allowedLinks.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive 
                  ? 'bg-voix-500/10 text-voix-500 border border-voix-500/20' 
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
      
      {/* Footer Branding */}
      <div className="p-4 border-t border-slate-800 text-center text-xs text-slate-500 font-mono">
        Voix Networks v2.0
      </div>
    </aside>
  );
}