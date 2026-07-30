// frontend/src/App.tsx
import { type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// We use curly braces { } because these are named exports
import { AuthProvider, useAuth } from './context/AuthContext';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import IPOChecker from './pages/IPOChecker';
import PortfolioNewsAdvisor from './pages/PortfolioNewsAdvisor';
import AnalyticsLab from './pages/AnalyticsLab';
import Layout from './components/Layout';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" reverseOrder={false} /> 
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/ipo" element={<IPOChecker />} />
            <Route path="/portfolio-advisor" element={<PortfolioNewsAdvisor />} />
            <Route path="/stock-forecaster" element={<AnalyticsLab />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;