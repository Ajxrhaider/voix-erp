import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function MainLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden w-full">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      <Sidebar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden w-full relative">
        <Header setIsMobileMenuOpen={setIsMobileMenuOpen} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 custom-scrollbar relative w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}