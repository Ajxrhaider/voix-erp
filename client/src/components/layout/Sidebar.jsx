import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import { X } from 'lucide-react';

export default function Sidebar({ isMobileMenuOpen, setIsMobileMenuOpen }) {
  const location = useLocation();
  const { user } = useContext(AppContext);

  const allNavItems = [
    { name: 'Dashboard', path: '/', roles: ['All'] },
    { name: 'Sales Pipeline', path: '/sales', roles: ['Sales', 'Management', 'GM', 'Dev'] },
    { name: 'Deployments', path: '/deployments', roles: ['Sales', 'NOC', 'Fiber', 'Management', 'GM', 'Dev'] },
    { name: 'CRM Profiles', path: '/customers', roles: ['Customer Service', 'Management', 'GM', 'Accounting', 'Dev'] },
    { name: 'Customer Service', path: '/cs', roles: ['Customer Service', 'Management', 'Dev'] },
    { name: 'NOC Desk', path: '/noc', roles: ['NOC', 'HOD NOC', 'Management', 'GM', 'Dev'] },
    { name: 'Fiber Teams', path: '/fiber', roles: ['Fiber', 'HOD Fiber', 'NOC', 'Management', 'GM', 'Dev'] },
    { name: 'Work Orders', path: '/work-orders', roles: ['Fiber', 'HOD Fiber', 'NOC', 'Customer Service', 'Management', 'Dev'] },
    { name: 'Inventory', path: '/inventory', roles: ['Inventory', 'Accounting', 'Management', 'GM', 'Dev'] },
    { name: 'Requisitions', path: '/requisitions', roles: ['All'] },
    { name: 'Accounting', path: '/accounting', roles: ['Accounting', 'Management', 'GM', 'Dev'] },
    { name: 'HR Directory', path: '/hr', roles: ['HR', 'Management', 'GM', 'Dev'] },
    { name: 'Management', path: '/management', roles: ['Management', 'GM', 'Dev'] },
    { name: 'IT Admin', path: '/admin', roles: ['Dev', 'Management'] },
  ];

  const allowedLinks = allNavItems.filter(item => 
    item.roles.includes('All') || 
    (user && user.roles?.some(r => item.roles.includes(r))) || 
    (user && (user.roles?.includes('Management') || user.roles?.includes('GM') || user.roles?.includes('Dev')))
  );

  return (
    <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-950 border-r border-slate-800 h-screen flex flex-col transform transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0">
        <Link to="/" onClick={() => setIsMobileMenuOpen && setIsMobileMenuOpen(false)} className="flex items-center gap-3 group">
          <div className="w-8 h-8 bg-voix-600 rounded-lg flex items-center justify-center p-1 shadow-md shadow-voix-600/20 group-hover:bg-voix-500 transition-colors">
            <img src="/voix-logo.png" alt="Voix Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-white font-bold text-lg tracking-wide">
            Voix <span className="text-voix-500">ERP</span>
          </span>
        </Link>
        <button onClick={() => setIsMobileMenuOpen && setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white p-1">
          <X className="w-6 h-6"/>
        </button>
      </div>

      <nav className="flex-1 py-6 px-3 flex flex-col gap-1 overflow-y-auto custom-scrollbar pb-24">
        {allowedLinks.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => setIsMobileMenuOpen && setIsMobileMenuOpen(false)}
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
      
      <div className="p-4 border-t border-slate-800 text-center text-xs text-slate-500 font-mono shrink-0">
        Voix Networks v2.1
      </div>
    </aside>
  );
}