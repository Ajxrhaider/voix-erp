import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { LogOut, Layers } from 'lucide-react';

export default function Layout({ children, visibleTabs, activeTab, setActiveTab }) {
  const { logoutUser } = useContext(AppContext);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-1.5 rounded text-white font-bold tracking-wider">VOIX</div>
          <span className="font-semibold text-slate-800">ERP Engine</span>
        </div>
        
        <nav className="flex space-x-2">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" /> 
                <span>{tab.label}</span>
              </button>
            );
          })}
          
          <button
            onClick={logoutUser}
            className="ml-4 flex items-center px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md font-medium"
          >
            <LogOut className="w-4 h-4 mr-1" /> Log Out
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {children}
      </main>
    </div>
  );
}