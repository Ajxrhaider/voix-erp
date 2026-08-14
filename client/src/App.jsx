import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, AppContext } from './context/AppContext';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';

// The 14 Required Modules
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

// Protected Route Wrapper (Keeps your original loading spinner)
const ProtectedRoute = ({ children }) => {
  const { user, token, loading } = useContext(AppContext);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300 font-sans text-sm">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Voix ERP...</span>
        </div>
      </div>
    );
  }
  
  return (user && token) ? children : <Navigate to="/login" replace />;
};

// Public Route Wrapper
const PublicRoute = ({ children }) => {
  const { user, token, loading } = useContext(AppContext);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300 font-sans text-sm">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Voix ERP...</span>
        </div>
      </div>
    );
  }

  return (!user || !token) ? children : <Navigate to="/" replace />;
};

// Main App Component
const AppContent = () => {
  return (
    <Router>
      <Routes>
        {/* Public Authentication Route */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } 
        />

        {/* Protected ERP Portal Layout */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          } 
        >
          {/* Main Module Views */}
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
        </Route>

        {/* Fallback Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}