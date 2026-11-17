import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_ENDPOINT, apiUrl } from '../utils/api';
import {
  getSessionTimeRemaining,
  isSessionIdle,
  SESSION_ACTIVITY_STORAGE_KEY,
  SESSION_ACTIVITY_SYNC_INTERVAL_MS
} from '../utils/sessionTimeout.js';

export const AppContext = createContext();

const LOCAL_ACTIVITY_WRITE_INTERVAL_MS = 2_000;
const IDLE_CHECK_RESCHEDULE_INTERVAL_MS = 1_000;

function clearStoredSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem(SESSION_ACTIVITY_STORAGE_KEY);
}

function loadStoredSession() {
  const sessionToken = localStorage.getItem('token') || '';
  const lastActivityAt = Number(localStorage.getItem(SESSION_ACTIVITY_STORAGE_KEY));
  let sessionUser = null;
  try {
    sessionUser = JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    sessionUser = null;
  }

  if (!sessionToken || !sessionUser || isSessionIdle(lastActivityAt)) {
    clearStoredSession();
    return { token: '', user: null, lastActivityAt: 0 };
  }

  return { token: sessionToken, user: sessionUser, lastActivityAt };
}

export function AppProvider({ children }) {
  const [storedSession] = useState(loadStoredSession);
  const [token, setToken] = useState(storedSession.token);
  const [user, setUser] = useState(storedSession.user);

  // Strict boot-loading flag
  const [loading, setLoading] = useState(true);

  const [staff, setStaff] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [teams, setTeams] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [requisitions, setRequisitions] = useState([]);

  // Physical locks to prevent infinite loops and stale async auth responses.
  const tokenRef = useRef(token);
  const socketRef = useRef(null);
  const isSyncing = useRef(false);
  const idleTimerRef = useRef(null);
  const lastActivityRef = useRef(storedSession.lastActivityAt);
  const lastLocalActivityWriteAtRef = useRef(storedSession.lastActivityAt);
  const lastServerActivitySyncAtRef = useRef(storedSession.lastActivityAt);
  const lastIdleCheckScheduledAtRef = useRef(0);
  const activitySyncInFlightRef = useRef(false);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const logout = useCallback(() => {
    const currentToken = tokenRef.current;
    if (currentToken) {
      void fetch(apiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` },
        keepalive: true
      }).catch(() => {});
    }

    clearStoredSession();
    tokenRef.current = '';
    lastActivityRef.current = 0;
    lastLocalActivityWriteAtRef.current = 0;
    lastServerActivitySyncAtRef.current = 0;
    setToken('');
    setUser(null);
    setStaff([]);
    setCustomers([]);
    setSales([]);
    setDeployments([]);
    setTickets([]);
    setTeams([]);
    setWorkOrders([]);
    setInventory([]);
    setLedger([]);
    setRequisitions([]);
    setLoading(false);
    isSyncing.current = false;

    // Sever the real-time link completely on logout.
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const login = useCallback((sessionToken, userData) => {
    const normalizedUser = { ...userData };
    if (typeof normalizedUser.roles === 'string') normalizedUser.roles = JSON.parse(normalizedUser.roles);
    if (!normalizedUser.roles && normalizedUser.role) normalizedUser.roles = [normalizedUser.role];

    const now = Date.now();
    localStorage.setItem('token', sessionToken);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(now));
    tokenRef.current = sessionToken;
    lastActivityRef.current = now;
    lastLocalActivityWriteAtRef.current = now;
    lastServerActivitySyncAtRef.current = now;
    setLoading(true);
    setToken(sessionToken);
    setUser(normalizedUser);
  }, []);

  const hasRole = useCallback((allowedRoles = []) => {
    if (!user || !user.roles) return false;
    if (user.roles.includes('GM') || user.roles.includes('Management') || user.roles.includes('Dev')) return true;
    return user.roles.some(r => allowedRoles.includes(r));
  }, [user]);

  const authFetch = useCallback(async (route, config = {}) => {
    const requestToken = tokenRef.current;
    const headers = new Headers(config.headers || {});
    if (requestToken) headers.set('Authorization', `Bearer ${requestToken}`);

    if (config.body instanceof FormData) {
      headers.delete('Content-Type');
    } else if (config.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(apiUrl(route), { ...config, headers });
    if (response.status === 401 && requestToken && tokenRef.current === requestToken) logout();
    return response;
  }, [logout]);

  const refreshSystemData = useCallback(async () => {
    // Abort if no token or if we are already currently syncing.
    if (!tokenRef.current || isSyncing.current) {
      if (!tokenRef.current) setLoading(false);
      return;
    }

    isSyncing.current = true;

    const safeFetch = async (route, setter) => {
      try {
        const res = await authFetch(route);
        if (res.ok) setter(await res.json());
      } catch (err) {}
    };

    await Promise.all([
      safeFetch('/api/auth/staff', setStaff),
      safeFetch('/api/crm/customers', setCustomers),
      safeFetch('/api/sales/pipeline', setSales),
      safeFetch('/api/deployments', setDeployments),
      safeFetch('/api/tickets', setTickets),
      safeFetch('/api/tickets/work-orders/list', setWorkOrders),
      safeFetch('/api/teams/daily', setTeams),
      safeFetch('/api/inventory', setInventory),
      safeFetch('/api/inventory/requisitions', setRequisitions),
      safeFetch('/api/accounting/ledger', setLedger)
    ]);

    setLoading(false); // Drop the loading screen once populated.
    isSyncing.current = false; // Unlock sync engine.
  }, [authFetch]);

  useEffect(() => {
    if (!token) {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
      return undefined;
    }

    const getLatestActivity = () => {
      const stored = Number(localStorage.getItem(SESSION_ACTIVITY_STORAGE_KEY));
      const local = Number.isFinite(stored) && stored > 0 ? stored : 0;
      return Math.max(lastActivityRef.current || 0, local);
    };

    const checkIdleTimeout = () => {
      const lastActivityAt = getLatestActivity();
      lastActivityRef.current = lastActivityAt;
      if (isSessionIdle(lastActivityAt)) {
        logout();
        return;
      }

      idleTimerRef.current = window.setTimeout(
        checkIdleTimeout,
        getSessionTimeRemaining(lastActivityAt) + 25
      );
    };

    const scheduleIdleCheck = () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      checkIdleTimeout();
    };

    const syncActivityWithServer = (now) => {
      if (activitySyncInFlightRef.current || now - lastServerActivitySyncAtRef.current < SESSION_ACTIVITY_SYNC_INTERVAL_MS) return;
      const activityToken = tokenRef.current;
      if (!activityToken) return;

      activitySyncInFlightRef.current = true;
      void fetch(apiUrl('/api/auth/activity'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${activityToken}` }
      }).then((response) => {
        if (response.status === 401 && tokenRef.current === activityToken) {
          logout();
        } else if (response.ok) {
          lastServerActivitySyncAtRef.current = now;
        }
      }).catch(() => {}).finally(() => {
        activitySyncInFlightRef.current = false;
      });
    };

    const recordUserActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;

      if (now - lastLocalActivityWriteAtRef.current >= LOCAL_ACTIVITY_WRITE_INTERVAL_MS) {
        localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(now));
        lastLocalActivityWriteAtRef.current = now;
      }

      if (now - lastIdleCheckScheduledAtRef.current >= IDLE_CHECK_RESCHEDULE_INTERVAL_MS) {
        lastIdleCheckScheduledAtRef.current = now;
        scheduleIdleCheck();
      }
      syncActivityWithServer(now);
    };

    const handleStorageChange = (event) => {
      if (event.key === SESSION_ACTIVITY_STORAGE_KEY && event.newValue) {
        const activityAt = Number(event.newValue);
        if (Number.isFinite(activityAt)) {
          lastActivityRef.current = Math.max(lastActivityRef.current || 0, activityAt);
          scheduleIdleCheck();
        }
        return;
      }

      if (event.key === 'token') {
        if (!event.newValue) {
          logout();
          return;
        }
        if (event.newValue !== tokenRef.current) {
          tokenRef.current = event.newValue;
          setToken(event.newValue);
          const activityAt = Number(localStorage.getItem(SESSION_ACTIVITY_STORAGE_KEY));
          if (Number.isFinite(activityAt)) {
            lastActivityRef.current = activityAt;
            lastLocalActivityWriteAtRef.current = activityAt;
            lastServerActivitySyncAtRef.current = activityAt;
          }
          try {
            setUser(JSON.parse(localStorage.getItem('user') || 'null'));
          } catch {
            logout();
          }
        }
        return;
      }

      if (event.key === 'user' && event.newValue && tokenRef.current) {
        try {
          setUser(JSON.parse(event.newValue));
        } catch {
          logout();
        }
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) scheduleIdleCheck();
    };

    const activityEvents = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll', 'touchstart', 'click', 'input'];
    for (const eventName of activityEvents) {
      document.addEventListener(eventName, recordUserActivity, { capture: true, passive: true });
    }
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    scheduleIdleCheck();

    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
      for (const eventName of activityEvents) {
        document.removeEventListener(eventName, recordUserActivity, true);
      }
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token, logout]);

  // Establish stable socket connection bypassing StrictMode bugs.
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    // Connect socket ONLY if it doesn't already exist.
    if (!socketRef.current) {
      socketRef.current = io(SOCKET_ENDPOINT, { withCredentials: true });
      socketRef.current.on('erp-data-changed', () => {
        refreshSystemData();
      });
      refreshSystemData(); // Initial data fetch.
    }

    // Intentionally omitting cleanup disconnect here so React 18 StrictMode
    // doesn't thrash the socket on dev-server hot-reloads.
  }, [token, refreshSystemData]);

  return (
    <AppContext.Provider value={{
      token, user, staff, customers, sales, deployments, tickets, teams,
      workOrders, inventory, ledger, requisitions, loading,
      authFetch, refreshSystemData, login, logout, hasRole
    }}>
      {children}
    </AppContext.Provider>
  );
}
