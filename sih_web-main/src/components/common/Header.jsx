import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";
import { LogOut, User, Bell, Settings, Menu, X, Home } from 'lucide-react';
import { ROLES, getDashboardRoute, getRoleName } from '../../utils/constants';

const Header = ({ title, showUserInfo = true, showNotifications = true }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even if logout API call fails
      navigate('/login');
    }
  };

  const goToDashboard = () => {
    // FIXED: Use standardized roles and helper function
    const dashboardPath = getDashboardRoute(currentUser?.role);
    navigate(dashboardPath);
    setShowDropdown(false);
    setShowMobileMenu(false);
  };

  const goToProfile = () => {
    navigate('/profile');
    setShowDropdown(false);
    setShowMobileMenu(false);
  };

  const goToSettings = () => {
    // FIXED: Use standardized role check
    if (currentUser?.role === ROLES.ADMIN) {
      navigate('/settings');
    } else {
      navigate('/profile');
    }
    setShowDropdown(false);
    setShowMobileMenu(false);
  };

  const navigateToPage = (path) => {
    navigate(path);
    setShowMobileMenu(false);
  };

  // Don't show header on login/signup pages
  if (location.pathname === '/login' || location.pathname === '/signup') {
    return null;
  }

  // Navigation items based on user role - FIXED
  const getNavigationItems = () => {
    if (!currentUser) return [];

    const baseItems = [
      { name: 'Dashboard', path: getDashboardRoute(currentUser.role), icon: Home },
      { name: 'Issues', path: '/issues', icon: Bell },
    ];

    // Add role-specific items
    if (currentUser.role === ROLES.ADMIN) {
      return [
        ...baseItems,
        { name: 'Analytics', path: '/analytics', icon: Settings },
        { name: 'Task Assignment', path: '/task-assignment', icon: User },
        { name: 'Escalation', path: '/escalation', icon: Bell },
        { name: 'Settings', path: '/settings', icon: Settings },
      ];
    } else if (currentUser.role === ROLES.STAFF) {
      return [
        ...baseItems,
        { name: 'Analytics', path: '/analytics', icon: Settings },
        { name: 'Task Assignment', path: '/task-assignment', icon: User },
        { name: 'Escalation', path: '/escalation', icon: Bell },
      ];
    } else if (currentUser.role === ROLES.SUPERVISOR) {
      return [
        ...baseItems,
        { name: 'Analytics', path: '/analytics', icon: Settings },
      ];
    }

    return baseItems;
  };

  const navigationItems = getNavigationItems();

  return (
    <header className="bg-slate-800 text-white shadow-lg relative z-40">
      <div className="px-4 sm:px-6 py-4">
        <div className="flex justify-between items-center">
          {/* Left side - Title and mobile menu button */}
          <div className="flex items-center space-x-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden p-2 rounded-md hover:bg-slate-700 transition-colors"
            >
              {showMobileMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            {/* Logo/Title */}
            <div className="flex items-center">
              <button 
                onClick={goToDashboard}
                className="text-xl font-bold hover:text-blue-300 transition-colors"
              >
                Civic Connect
              </button>
              {title && (
                <span className="ml-4 text-lg text-gray-300 hidden sm:block">
                  | {title}
                </span>
              )}
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-6">
            {navigationItems.map((item) => (
              <button
                key={item.name}
                onClick={() => navigateToPage(item.path)}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-slate-700 text-blue-300'
                    : 'hover:bg-slate-700 hover:text-blue-300'
                }`}
              >
                <item.icon className="h-4 w-4 mr-2" />
                {item.name}
              </button>
            ))}
          </nav>

          {/* Right side - User info and actions */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            {showNotifications && (
              <button className="p-2 rounded-md hover:bg-slate-700 transition-colors relative">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-xs flex items-center justify-center">
                  3
                </span>
              </button>
            )}

            {/* User menu */}
            {showUserInfo && currentUser && (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-700 transition-colors"
                >
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-medium">{currentUser.fullname || currentUser.email}</div>
                    <div className="text-xs text-gray-400">{getRoleName(currentUser.role)}</div>
                  </div>
                  <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5" />
                  </div>
                </button>

                {/* Dropdown menu */}
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-2 z-50">
                    <button
                      onClick={goToProfile}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </button>
                    <button
                      onClick={goToSettings}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      {currentUser.role === ROLES.ADMIN ? 'Settings' : 'Preferences'}
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {showMobileMenu && (
        <div className="lg:hidden bg-slate-700 border-t border-slate-600">
          <nav className="px-4 py-2 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.name}
                onClick={() => navigateToPage(item.path)}
                className={`flex items-center w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-slate-600 text-blue-300'
                    : 'hover:bg-slate-600 hover:text-blue-300'
                }`}
              >
                <item.icon className="h-4 w-4 mr-2" />
                {item.name}
              </button>
            ))}
            
            {/* Mobile user actions */}
            {currentUser && (
              <>
                <hr className="border-slate-600 my-2" />
                <div className="px-3 py-2 text-xs text-gray-400">
                  {currentUser.fullname || currentUser.email} • {getRoleName(currentUser.role)}
                </div>
                <button
                  onClick={goToProfile}
                  className="flex items-center w-full px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-600 hover:text-blue-300"
                >
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-3 py-2 rounded-md text-sm font-medium text-red-300 hover:bg-red-600 hover:text-white"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </button>
              </>
            )}
          </nav>
        </div>
      )}

      {/* Backdrop for dropdowns */}
      {(showDropdown || showMobileMenu) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setShowDropdown(false);
            setShowMobileMenu(false);
          }}
        />
      )}
    </header>
  );
};

export default Header;