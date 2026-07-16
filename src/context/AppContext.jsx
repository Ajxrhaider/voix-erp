const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { io } from 'socket.io-client'; // NEW: WebSocket Client

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
  
  // New States needed for Marketer/Sales and CRM
  const [surveyTickets, setSurveyTickets] = useState([]);
  const [pendingDeployments, setPendingDeployments] = useState([]);
  const [queryTickets, setQueryTickets] = useState([]);
  const [installationTickets, setInstallationTickets] = useState([]);

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

  const authFetch = async (url, options = {}) => {
    const finalUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };
    const response = await fetch(finalUrl, { ...options, headers });
    if (response.status === 401 || response.status === 403) logoutUser();
    return response;
  };

  const refreshData = useCallback(async () => {
    if (!token) return;
    try {
      const [custRes, invRes, woRes, reqRes, empRes, vehRes, repRes, srvRes, depRes, queryRes, instRes] = await Promise.all([
        authFetch('/api/customers'),
        authFetch('/api/inventory'),
        authFetch('/api/work-orders'),
        authFetch('/api/requisitions'),
        authFetch('/api/hr/employees'), 
        authFetch('/api/vehicles'),
        authFetch('/api/daily-reports'),
        authFetch('/api/survey-tickets'),        // NEW
        authFetch('/api/pending-deployments'),   // NEW
        authFetch('/api/query-tickets'),         // NEW
        authFetch('/api/installation-tickets')   // NEW
      ]);

      if (custRes.ok) setCustomers(await custRes.json());
      if (invRes.ok) setInventory(await invRes.json());
      if (woRes.ok) setWorkOrders(await woRes.json());
      if (reqRes.ok) setRequisitions(await reqRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
      if (vehRes.ok) setVehicles(await vehRes.json());
      if (repRes.ok) setDailyReports(await repRes.json());
      if (srvRes.ok) setSurveyTickets(await srvRes.json());
      if (depRes.ok) setPendingDeployments(await depRes.json());
      if (queryRes.ok) setQueryTickets(await queryRes.json());
      if (instRes.ok) setInstallationTickets(await instRes.json());
    } catch (err) {
      console.error('Failed to synchronize state with server:', err);
    }
  }, [token]);

  // WEBSOCKET: Listen for backend changes and refresh silently
  useEffect(() => {
    if (!token) return;
    const socket = io(API_URL);
    
    socket.on('erp-data-changed', () => {
      console.log('Real-time update received from server. Syncing...');
      refreshData();
    });

    return () => socket.disconnect();
  }, [token, refreshData]);

  // Initial load
  useEffect(() => {
    if (token) refreshData();
  }, [token, refreshData]);

  const loginUser = (newToken) => setToken(newToken);
  const logoutUser = () => {
    setToken('');
    setUser(null);
    setCustomers([]); setInventory([]); setWorkOrders([]); setRequisitions([]);
    setEmployees([]); setVehicles([]); setDailyReports([]); setSurveyTickets([]);
    setPendingDeployments([]); setQueryTickets([]); setInstallationTickets([]);
    localStorage.removeItem('token');
  };
  
  return (
    <AppContext.Provider value={{
      token, user, customers, inventory, workOrders, requisitions, employees,
      vehicles, dailyReports, surveyTickets, pendingDeployments, queryTickets, 
      installationTickets, authFetch, refreshData, loginUser, logoutUser
    }}>
      {children}
    </AppContext.Provider>
  );
}