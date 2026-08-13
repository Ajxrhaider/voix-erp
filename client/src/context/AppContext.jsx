import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND_ENDPOINT = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const AppContext = createContext();

export function AppProvider({ children }) {
  const [token, setToken] = useState(() => {
    return localStorage.getItem('voix_token') || localStorage.getItem('token') || '';
  });
  
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem('voix_user') || localStorage.getItem('user');
    return cached ? JSON.parse(cached) : null;
  });

  const [staff, setStaff] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [dailyTeams, setDailyTeams] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(false);

  const tokenRef = useRef(token);

  // Keep ref synchronized smoothly
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // 1. Defined before authFetch using useCallback so it maintains a stable reference
  const logout = useCallback(() => {
    // Wipes both current and legacy localStorage keys
    localStorage.removeItem('voix_token');
    localStorage.removeItem('voix_user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    tokenRef.current = '';
    setToken('');
    setUser(null);
  }, []);

  // 2. Stable login handler
  const login = useCallback((sessionToken, userData) => {
    localStorage.setItem('voix_token', sessionToken);
    localStorage.setItem('voix_user', JSON.stringify(userData));
    
    tokenRef.current = sessionToken;
    setToken(sessionToken);
    setUser(userData);
  }, []);

  // 3. authFetch cleanly incorporates the memoized logout handler
  const authFetch = useCallback(async (route, config = {}) => {
    const currentToken = tokenRef.current;
    const headers = {
      'Content-Type': 'application/json',
      ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
      ...(config.headers || {})
    };
    
    const response = await fetch(`${BACKEND_ENDPOINT}${route}`, { ...config, headers });
    
    if (response.status === 401 || response.status === 403) {
      logout();
    }
    return response;
  }, [logout]);

  const refreshSystemData = useCallback(async () => {
    if (!tokenRef.current) return;
    setLoading(true);

    const safeFetch = async (route, setter) => {
      try {
        const res = await authFetch(route);
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            setter(data);
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch ${route}:`, err);
      }
    };

    await Promise.all([
      safeFetch('/api/hr/staff', setStaff),
      safeFetch('/api/crm/customers', setCustomers),
      safeFetch('/api/sales/pipeline', setSales),
      safeFetch('/api/deployments', setDeployments),
      safeFetch('/api/tickets', setTickets),
      safeFetch('/api/teams/daily', setDailyTeams),
      safeFetch('/api/work-orders', setWorkOrders),
      safeFetch('/api/inventory', setInventory),
      safeFetch('/api/accounting/ledger', setLedger),
      safeFetch('/api/requisitions', setRequisitions)
    ]);

    setLoading(false);
  }, [authFetch]);

  useEffect(() => {
    if (!token) return;
    
    let socket;
    try {
      socket = io(BACKEND_ENDPOINT);
      socket.on('erp-data-changed', () => {
        refreshSystemData();
      });
    } catch (e) {
      console.warn("Socket initialization skipped:", e);
    }

    refreshSystemData();

    return () => {
      if (socket) socket.disconnect();
    };
  }, [token, refreshSystemData]);

  return (
    <AppContext.Provider value={{
      token, user, staff, customers, sales, deployments, tickets, dailyTeams,
      workOrders, inventory, ledger, requisitions, loading,
      authFetch, refreshSystemData, login, logout
    }}>
      {children}
    </AppContext.Provider>
  );
}