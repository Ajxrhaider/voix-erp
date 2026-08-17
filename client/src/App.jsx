import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, AppContext } from './context/AppContext';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';

// The 14 Modules
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Deployments from './pages/Deployments';
import Customers from './pages/Customers';
import CustomerService from './pages/CustomerService';
import NOC from './pages/NOC';
import Fiber from './pages/Fiber';
import WorkOrders from './pages/WorkOrders';
import Inventory from './pages/Inventory';
import Requisitions from './pages/Requisitions';
import Accounting from './pages/Accounting';
import HR from './pages/HR';
import Management from './pages/Management';
import Admin from './pages/Admin';
import Profile from './pages/Profile';

const ProtectedRoute = ({ children }) => {
  const { user, token, loading } = useContext(AppContext);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 font-sans text-sm gap-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="font-bold tracking-widest uppercase text-xs text-emerald-500">Initializing Core Engine...</span>
      </div>
    );
  }
  
  return (user && token) ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { user, token, loading } = useContext(AppContext);
  
  if (loading) return null; // Avoid flashing login screen if token exists
  
  return (!user || !token) ? children : <Navigate to="/" replace />;
};

export default function App() {
  return (
    <AppProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

          <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="sales" element={<Sales />} />
            <Route path="deployments" element={<Deployments />} />
            <Route path="customers" element={<Customers />} />
            <Route path="cs" element={<CustomerService />} />
            <Route path="noc" element={<NOC />} />
            <Route path="fiber" element={<Fiber />} />
            <Route path="work-orders" element={<WorkOrders />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="requisitions" element={<Requisitions />} />
            <Route path="accounting" element={<Accounting />} />
            <Route path="hr" element={<HR />} />
            <Route path="management" element={<Management />} />
            <Route path="admin" element={<Admin />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AppProvider>
  );
}