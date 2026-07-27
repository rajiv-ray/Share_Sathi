import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Building2, BrainCircuit, 
  LogOut, Menu, X, Activity 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Portfolio', path: '/', icon: LayoutDashboard },
    { name: 'IPO Hub', path: '/ipo', icon: Building2 },
    { name: 'AI Analytics', path: '/analytics', icon: BrainCircuit },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans text-gray-900">
      
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 flex items-center justify-between px-4">
        <div className="flex items-center text-blue-600 font-bold text-xl">
          <Activity className="w-6 h-6 mr-2" />
          Share Sathi
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-gray-600 rounded-lg hover:bg-gray-100"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col
        ${isMobileMenuOpen ? 'translate-x-0 pt-16' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Desktop Logo */}
        <div className="hidden lg:flex items-center h-16 px-6 border-b border-gray-100">
          <Activity className="w-6 h-6 mr-2 text-blue-600" />
          <span className="text-xl font-bold text-gray-900">Share Sathi</span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => `
                flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors
                ${isActive 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
              `}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        {/* User Actions */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-sm font-medium text-rose-600 rounded-xl hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Secure Logout
          </button>
        </div>
      </aside>

      {/* Overlay for mobile when menu is open */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0">
        {/* The <Outlet /> is the magic window where React Router renders your current page */}
        <Outlet />
      </main>

    </div>
  );
}