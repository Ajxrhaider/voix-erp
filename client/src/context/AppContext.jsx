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
  const [teams, setTeams] = useState([]); // Renamed from dailyTeams to match new UI
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

  // Wipes both current and legacy localStorage keys
  const logout = useCallback(() => {
    localStorage.removeItem('voix_token');
    localStorage.removeItem('voix_user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    tokenRef.current = '';
    setToken('');
    setUser(null);
  }, []);

  // Stable login handler
  const login = useCallback((sessionToken, userData) => {
    localStorage.setItem('voix_token', sessionToken);
    localStorage.setItem('voix_user', JSON.stringify(userData));
    localStorage.setItem('token', sessionToken);
    localStorage.setItem('user', JSON.stringify(userData));
    
    tokenRef.current = sessionToken;
    setToken(sessionToken);
    setUser(userData);
  }, []);

  // authFetch cleanly incorporates the memoized logout handler & handles File Uploads
  const authFetch = useCallback(async (route, config = {}) => {
    const currentToken = tokenRef.current;
    
    const headers = {
      ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
      ...(config.headers || {})
    };

    // Auto-set JSON content type UNLESS we are uploading a file (FormData)
    if (!(config.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    } else {
      delete headers['Content-Type']; // Let browser set boundary automatically for multipart/form-data
    }
    
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

    // Updated endpoints to match the new modular backend architecture
    await Promise.all([
      safeFetch('/api/auth/staff', setStaff),
      safeFetch('/api/crm/customers', setCustomers),
      safeFetch('/api/sales/pipeline', setSales),
      safeFetch('/api/deployments', setDeployments),
      safeFetch('/api/tickets', setTickets),
      safeFetch('/api/tickets/work-orders/list', setWorkOrders), // New route
      safeFetch('/api/teams/daily', setTeams),
      safeFetch('/api/inventory', setInventory),
      safeFetch('/api/inventory/requisitions', setRequisitions), // New route
      safeFetch('/api/accounting/ledger', setLedger)
    ]);

    setLoading(false);
  }, [authFetch]);

  useEffect(() => {
    if (!token) return;
    
    let socket;
    try {
      socket = io(BACKEND_ENDPOINT);
      socket.on('erp-data-changed', () => {
        refreshSystemData(); // Silently updates UI for everyone when data changes
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
      token, user, staff, customers, sales, deployments, tickets, teams,
      workOrders, inventory, ledger, requisitions, loading,
      authFetch, refreshSystemData, login, logout
    }}>
      {children}
    </AppContext.Provider>
  );
}