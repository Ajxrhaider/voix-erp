const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';

export const AppContext = createContext();

export function AppProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  
  // Core application entities
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [dailyReports, setDailyReports] = useState([]);

  // Decode JWT user session details when the token changes
  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser(decoded);
        localStorage.setItem('token', token);
      } catch (err) {
        console.error('Invalid token decode:', err);
        logoutUser();
      }
    } else {
      setUser(null);
      localStorage.removeItem('token');
    }
  }, [token]);

  // Authenticated fetch wrapper injecting Bearer token
  const authFetch = async (url, options = {}) => {
    // Automatically prepend the API_URL if the path doesn't already start with http
    const finalUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const response = await fetch(finalUrl, { ...options, headers });

    if (response.status === 401 || response.status === 403) {
      logoutUser();
    }
    return response;
  };

  // Fetch all centralized enterprise datasets
  const refreshData = useCallback(async () => {
    if (!token) return;

    try {
      const [custRes, invRes, woRes, reqRes, empRes, vehRes, repRes] = await Promise.all([
        authFetch('/api/customers'),
        authFetch('/api/inventory'),
        authFetch('/api/work-orders'),
        authFetch('/api/requisitions'),
        authFetch('/api/employees'),
        authFetch('/api/vehicles'),         // NEW
        authFetch('/api/daily-reports')     // NEW
      ]);

      if (custRes.ok) setCustomers(await custRes.json());
      if (invRes.ok) setInventory(await invRes.json());
      if (woRes.ok) setWorkOrders(await woRes.json());
      if (reqRes.ok) setRequisitions(await reqRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
      if (vehRes.ok) setVehicles(await vehRes.json());
      if (repRes.ok) setDailyReports(await repRes.json());
    } catch (err) {
      console.error('Failed to synchronize state with server:', err);
    }
  }, [token]);

  // Load datasets automatically when an active token is established
  useEffect(() => {
    if (token) {
      refreshData();
    }
  }, [token, refreshData]);

  const loginUser = (newToken) => {
    setToken(newToken);
  };

  const logoutUser = () => {
    setToken('');
    setUser(null);
    setCustomers([]);
    setInventory([]);
    setWorkOrders([]);
    setRequisitions([]);
    setEmployees([]);
    localStorage.removeItem('token');
  };
  
  return (
    <AppContext.Provider value={{
      token,
      user,
      customers,
      inventory,
      workOrders,
      requisitions,
      employees,
      vehicles,       // Ensure these are included
      setVehicles,
      dailyReports,
      setDailyReports,
      authFetch,
      refreshData,
      loginUser,
      logoutUser
    }}>
      {children}
    </AppContext.Provider>
  );
}