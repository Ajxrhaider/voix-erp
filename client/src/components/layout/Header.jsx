import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Bell, CheckCheck, LogOut, User, Menu } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';

export default function Header({ setIsMobileMenuOpen }) {
  const { user, logout, authFetch } = useContext(AppContext);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await authFetch('/api/auth/notifications');
      if (response.ok) setNotifications(await response.json());
    } catch {
      // The main app remains usable if the notifications endpoint is offline.
    }
  }, [authFetch, user?.id]);

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 60_000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const markAsRead = async (notificationId) => {
    const response = await authFetch(`/api/auth/notifications/${notificationId}/read`, { method: 'PATCH' });
    if (response.ok) setNotifications((current) => current.filter((item) => item.id !== notificationId));
  };

  const markAllRead = async () => {
    const response = await authFetch('/api/auth/notifications/read-all', { method: 'PATCH' });
    if (response.ok) setNotifications([]);
  };

  const primaryRole = (user?.roles || [])[0] || 'User';

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shadow-sm no-print sticky top-0 z-30 w-full">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsMobileMenuOpen?.(true)}
          aria-label="Open navigation menu"
          className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg md:hidden"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-bold text-slate-800 hidden sm:block">Portal Overview</h2>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <div className="relative">
          <button
            type="button"
            aria-label={`Notifications${notifications.length ? `, ${notifications.length} unread` : ''}`}
            aria-expanded={notificationsOpen}
            onClick={() => setNotificationsOpen((open) => !open)}
            className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-voix-600 transition"
          >
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-600 rounded-full border-2 border-white text-[8px] font-bold text-white flex items-center justify-center">
                {notifications.length > 99 ? '99+' : notifications.length}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-full mt-2 w-[min(24rem,calc(100vw-1.5rem))] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-50">
              <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                  <p className="text-xs text-slate-500">Payment reminders and account updates</p>
                </div>
                {notifications.length > 0 && (
                  <button onClick={markAllRead} className="text-xs font-semibold text-voix-700 hover:text-voix-900 flex items-center gap-1">
                    <CheckCheck className="w-3.5 h-3.5" /> Clear all
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-500">You’re all caught up.</p>
                ) : notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => markAsRead(notification.id)}
                    className="block w-full px-4 py-3 text-left hover:bg-slate-50 transition"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${notification.type === 'Payment Due' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-slate-900">{notification.title}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-slate-600">{notification.message}</span>
                        <span className="mt-1.5 block text-[10px] text-slate-400">
                          {notification.created_at ? new Date(`${notification.created_at.replace(' ', 'T')}Z`).toLocaleString() : 'Just now'}
                        </span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold text-slate-800">{user?.fullname}</p>
            <p className="text-[10px] uppercase font-bold text-voix-600 tracking-wider">{primaryRole}</p>
          </div>
          <div className="flex gap-1 sm:gap-2 border-l border-slate-200 pl-3 sm:pl-4">
            <Link to="/profile" className="p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition" title="My Account">
              <User className="w-5 h-5 sm:w-4 sm:h-4" />
            </Link>
            <button onClick={handleLogout} className="p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition" title="Logout">
              <LogOut className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
