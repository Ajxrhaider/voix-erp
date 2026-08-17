import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND_ENDPOINT = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const AppContext = createContext();

export function AppProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem('user');
    return cached ? JSON.parse(cached) : null;
  });

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

  // Physical locks to prevent infinite loops
  const tokenRef = useRef(token);
  const socketRef = useRef(null);
  const isSyncing = useRef(false);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    tokenRef.current = '';
    setToken('');
    setUser(null);
    setLoading(false);
    
    // Sever the real-time link completely on logout
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const login = useCallback((sessionToken, userData) => {
    if (typeof userData.roles === 'string') userData.roles = JSON.parse(userData.roles);
    if (!userData.roles && userData.role) userData.roles = [userData.role];

    localStorage.setItem('token', sessionToken);
    localStorage.setItem('user', JSON.stringify(userData));
    tokenRef.current = sessionToken;
    setToken(sessionToken);
    setUser(userData);
  }, []);

  const hasRole = useCallback((allowedRoles = []) => {
    if (!user || !user.roles) return false;
    if (user.roles.includes('GM') || user.roles.includes('Management') || user.roles.includes('Dev')) return true;
    return user.roles.some(r => allowedRoles.includes(r));
  }, [user]);

  const authFetch = useCallback(async (route, config = {}) => {
    const headers = {
      ...(tokenRef.current ? { 'Authorization': `Bearer ${tokenRef.current}` } : {}),
      ...(config.headers || {})
    };
    
    if (!(config.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    else delete headers['Content-Type'];

    const response = await fetch(`${BACKEND_ENDPOINT}${route}`, { ...config, headers });
    if (response.status === 401 || response.status === 403) logout();
    return response;
  }, [logout]);

  const refreshSystemData = useCallback(async () => {
    // Abort if no token or if we are already currently syncing
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
    
    setLoading(false); // Drop the loading screen once populated
    isSyncing.current = false; // Unlock sync engine
  }, [authFetch]);

  // Establish stable socket connection bypassing StrictMode bugs
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    // Connect socket ONLY if it doesn't already exist
    if (!socketRef.current) {
      socketRef.current = io(BACKEND_ENDPOINT);
      socketRef.current.on('erp-data-changed', () => {
        refreshSystemData();
      });
      refreshSystemData(); // Initial data fetch
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