import React, { useState, useContext, useEffect } from 'react';
import { AppProvider, AppContext } from './context/AppContext';
import AuthModule from './components/Auth/AuthModule'; // Fixed import path
import { Users, Network, Calculator, Wrench, Briefcase, TrendingUp, LogOut, Coins, Layers } from 'lucide-react';
import { ShoppingCart, Truck } from 'lucide-react'; // Ensure these icons are imported
// Import new module

// Core Business Modules
import CRMModule from './components/CRM/CRMModule';
import NOCModule from './components/NOC/NOCModule';
import AccountingModule from './components/Accounting/AccountingModule';
import FieldModule from './components/FieldModule'; 
import SalesModule from './components/SalesModule';     
import ManagementModule from './components/ManagementModule'; 
import HRModule from './components/HR/HRModule';
import CTOModule from './components/Operations/CTOModule';
import FleetModule from './components/Operations/FleetModule';
import RequisitionsModule from './components/RequisitionsModule';

function Layout({ children, activeTab, setActiveTab }) {
  const { user, logoutUser } = useContext(AppContext);

  // Fallback to 'guest' if user session details aren't populated yet
  const role = user?.role || 'guest';
  
  const allTabs = [
  { id: 'crm', label: 'Customer Service', icon: Users, roles: ['dev', 'noc', 'sales', 'management'] },
  { id: 'sales', label: 'Sales & Surveys', icon: TrendingUp, roles: ['dev', 'sales', 'management'] },
  { id: 'noc', label: 'NOC Dispatch', icon: Network, roles: ['dev', 'noc', 'management'] },
  { id: 'cto', label: 'CTO Planning & Dispatch', icon: Layers, roles: ['dev', 'noc', 'management'] },
  { id: 'field', label: 'Field Crews', icon: Wrench, roles: ['dev', 'fiber', 'noc'] },
  { id: 'accounting', label: 'Accounting Matrix', icon: Calculator, roles: ['dev', 'account', 'management'] },
  { id: 'hr_payroll', label: 'HR & Payroll Engine', icon: Coins, roles: ['dev', 'account', 'management'] }, // ADDED TAB
  { id: 'management', label: 'GM Command Desk', icon: Briefcase, roles: ['dev', 'management'] },
  { id: 'fleet', label: 'Fleet & Logistics', icon: Truck, roles: ['dev', 'noc', 'management', 'cto'] },
  { id: 'requisitions', label: 'Requisitions', icon: ShoppingCart, roles: ['dev', 'noc', 'sales', 'field', 'management', 'cto', 'account'] }
  ];

  const visibleTabs = allTabs.filter(tab => tab.roles.includes(role));

  // Auto-select first available tab if active role restriction shifts visibility
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find(t => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [role, visibleTabs, activeTab]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-1.5 rounded text-white font-bold tracking-wider text-sm">VOIX</div>
          <span className="font-semibold text-slate-800 text-sm">
            ERP Engine 
            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 ml-2 font-mono">
              Role: {role.toUpperCase()}
            </span>
          </span>
        </div>
        <nav className="flex space-x-2">
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id)} 
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Icon className="w-4 h-4" /> <span>{tab.label}</span>
              </button>
            )
          })}
          <button onClick={logoutUser} className="ml-4 flex items-center px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md font-medium transition-colors">
            <LogOut className="w-4 h-4 mr-1" /> Log Out
          </button>
        </nav>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">{children}</main>
    </div>
  );
}

function AppContent() {
  const { token } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('crm');

  if (!token) return <AuthModule />;

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'crm' && <CRMModule />}
      {activeTab === 'sales' && <SalesModule />}
      {activeTab === 'noc' && <NOCModule />}
      {activeTab === 'field' && <FieldModule />}
      {activeTab === 'accounting' && <AccountingModule />}
      {activeTab === 'hr_payroll' && <HRModule />} {/* ADDED INTERACTIVE COMPONENT ROUTE */}
      {activeTab === 'management' && <ManagementModule />}
      {activeTab === 'cto' && <CTOModule />} {/* ADDED INTERACTIVE COMPONENT ROUTE */}
      {activeTab === 'fleet' && <FleetModule />}
      {activeTab === 'requisitions' && <RequisitionsModule />}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
