import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { Bell, LogOut, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Header() {
  const { user, logout } = useContext(AppContext);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);

  // CRITICAL LOOP FIX: Use native fetch decoupled from context to avoid dependency chaining
  useEffect(() => {
    let isMounted = true;
    const fetchNotifs = async () => {
      try {
        const token = localStorage.getItem('token');
        const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/notifications`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` }});
        if (res.ok && isMounted) {
          const data = await res.json();
          setNotifications(data);
        }
      } catch (e) {}
    };
    
    if (user?.id) fetchNotifs();
    
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); 

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const primaryRole = (user?.roles || [])[0] || 'User';

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm no-print">
      <h2 className="text-lg font-bold text-slate-800 hidden sm:block">Portal Overview</h2>

      <div className="flex items-center gap-6">
        <div className="relative cursor-pointer">
          <Bell className="w-5 h-5 text-slate-600 hover:text-voix-600 transition" />
          {notifications.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white text-[8px] font-bold text-white flex items-center justify-center">
              {notifications.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold text-slate-800">{user?.fullname}</p>
            <p className="text-[10px] uppercase font-bold text-voix-600 tracking-wider">{primaryRole}</p>
          </div>
          
          <div className="flex gap-2 border-l border-slate-200 pl-4">
            <Link to="/profile" className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition" title="My Account">
              <User className="w-4 h-4" />
            </Link>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}