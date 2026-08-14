import React from 'react';

export default function ModuleLayout({ 
  title, 
  badgeText, 
  subtitle, 
  icon, 
  headerActions, 
  tabs, 
  activeTab, 
  onTabChange, 
  kpis, 
  filterBar, 
  children 
}) {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Top Header (Dark Slate-900) */}
      <header className="bg-slate-900 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4 no-print">
        <div className="flex items-center space-x-3">
          <div className="bg-voix-600 p-2.5 rounded-lg shadow-lg text-white">
            {icon || (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
              </svg>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              {title} 
              {badgeText && (
                <span className="text-xs bg-voix-500/30 text-voix-300 border border-voix-400/30 px-2.5 py-0.5 rounded-full font-semibold">
                  {badgeText}
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {headerActions}
        </div>
      </header>

      {/* 2. Main Content Tabs */}
      {tabs && tabs.length > 0 && (
        <div className="bg-white p-2 rounded-xl border border-slate-200 flex space-x-2 text-xs font-bold overflow-x-auto no-print shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-2 rounded-lg transition whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* 3. KPI Summary Cards */}
      {kpis && kpis.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
          {kpis.map((kpi, idx) => (
            <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{kpi.title}</p>
              <p className={`text-2xl font-bold mt-1 ${kpi.colorClass || 'text-slate-900'}`}>
                {kpi.value}
              </p>
              <p className="text-xs text-slate-400 mt-1">{kpi.subtitle}</p>
            </div>
          ))}
        </div>
      )}

      {/* 4. Filter / Search Bar */}
      {filterBar && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-3 items-center justify-between no-print">
          {filterBar}
        </div>
      )}

      {/* 5. Main Content Area (Tables, Kanban, Forms) */}
      <div className="w-full">
        {children}
      </div>
    </div>
  );
}