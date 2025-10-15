import React, { useState } from 'react';
import { useAuth } from "../../context/AuthContext";
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  BarChart3, 
  FileText, 
  AlertTriangle, 
  Settings, 
  Users, 
  Briefcase, 
  LogOut,
  Home,
  MapPin,
  Upload,
  TrendingUp,
  UserCheck,
  Calendar,
  Bell,
  Shield,
  Database,
  ChevronDown,
  ChevronRight,
  Activity,
  ClipboardList,
  MessageCircle
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [expandedSections, setExpandedSections] = useState({
    issues: false,
    assignments: false,
    reports: false
  });

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even if logout fails
      navigate('/login');
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Navigation items based on role and backend endpoints
  const getNavigationItems = () => {
    if (!currentUser) {
      console.log('No current user found');
      return [];
    }

    // DEBUG: Log the current user role
    console.log('Current User Role:', currentUser.role);
    console.log('Current User:', currentUser);

    const baseItems = [];

    // Check for different possible role formats
    const userRole = currentUser.role;
    
    if (userRole === 'Admin') {
      baseItems.push(
        { 
          path: '/admin-dashboard', 
          icon: Home, 
          label: 'Dashboard Overview',
          description: 'System overview and statistics'
        },
        {
          type: 'section',
          key: 'issues',
          label: 'Issue Management',
          icon: FileText,
          expanded: expandedSections.issues,
          items: [
            { path: '/issues', icon: FileText, label: 'All Issues', badge: 'view' },
            { path: '/issues/create', icon: Upload, label: 'Create Issue' },
            { path: '/issues/search', icon: BarChart3, label: 'Search & Filter' },
            { path: '/issues/map', icon: MapPin, label: 'Issue Map' }
          ]
        },
        {
          type: 'section',
          key: 'assignments',
          label: 'Assignments',
          icon: Briefcase,
          expanded: expandedSections.assignments,
          items: [
            { path: '/assignments', icon: ClipboardList, label: 'All Assignments' },
            { path: '/assignments/bulk', icon: Users, label: 'Bulk Assign' },
            { path: '/assignments/stats', icon: TrendingUp, label: 'Assignment Stats' }
          ]
        },
        { path: '/users', icon: Users, label: 'User Management', badge: 'admin' },
        { path: '/departments', icon: Shield, label: 'Department Stats' },
        {
          type: 'section',
          key: 'reports',
          label: 'Analytics & Reports',
          icon: BarChart3,
          expanded: expandedSections.reports,
          items: [
            { path: '/analytics', icon: TrendingUp, label: 'Analytics Dashboard' },
            { path: '/analytics/trends', icon: Activity, label: 'Trend Analysis' },
            { path: '/analytics/performance', icon: BarChart3, label: 'Performance Metrics' },
            { path: '/analytics/export', icon: Database, label: 'Data Export' }
          ]
        },
        { path: '/files', icon: Upload, label: 'File Management' },
        { path: '/settings', icon: Settings, label: 'System Settings', badge: 'admin' },
        { path: '/chatbot', icon: MessageCircle, label: 'AI Assistant', badge: 'new' }
      );
    } else if (userRole === 'DepartmentStaff' || userRole === 'staff') {
      console.log('Adding DepartmentStaff navigation items');
      baseItems.push(
        { 
          path: '/staff-dashboard', 
          icon: Home, 
          label: 'Department Dashboard',
          description: `${currentUser.department || 'Your'} Department`
        },
        {
          type: 'section',
          key: 'issues',
          label: 'Issue Management',
          icon: FileText,
          expanded: expandedSections.issues,
          items: [
            { path: '/issues', icon: FileText, label: 'Department Issues' },
            // REMOVED: Report Issue option for department staff
            { path: '/issues/map', icon: MapPin, label: 'Department Map' }
          ]
        },
        {
          type: 'section',
          key: 'assignments',
          label: 'Task Management',
          icon: Briefcase,
          expanded: expandedSections.assignments,
          items: [
            { path: '/task-assignment', icon: ClipboardList, label: 'Task Assignment' }
            // REMOVED: Other sub-menu items, only keeping main task assignment
          ]
        },
        { path: '/staff', icon: Users, label: 'Department Staff' },
        { path: '/updates', icon: Bell, label: 'Issue Updates' },
        { path: '/analytics', icon: BarChart3, label: 'Department Analytics' },
        { path: '/chatbot', icon: MessageCircle, label: 'AI Assistant', badge: 'new' }
      );
    } else if (userRole === 'FieldSupervisor' || userRole === 'supervisor') {
      baseItems.push(
        { 
          path: '/supervisor-dashboard', 
          icon: Home, 
          label: 'My Tasks',
          description: 'Field assignments and updates'
        },
        { path: '/assignments/my', icon: Briefcase, label: 'My Assignments' },
        { path: '/updates/create', icon: Upload, label: 'Submit Update' },
        { path: '/issues/nearby', icon: MapPin, label: 'Nearby Issues' },
        { path: '/files/upload', icon: Upload, label: 'Upload Photos' }
      );
    } else {
      console.log('Unknown user role:', userRole);
    }

    // Add chatbot option for all roles
    baseItems.push(
      { path: '/chatbot', icon: MessageCircle, label: 'AI Assistant', badge: 'new' }
    );

    console.log('Final navigation items:', baseItems);
    return baseItems;
  };

  const navigationItems = getNavigationItems();

  const isActive = (path) => {
    if (path === location.pathname) return true;
    // Check if current path starts with the navigation path (for sub-routes)
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const isParentActive = (items) => {
    return items.some(item => isActive(item.path));
  };

  const renderNavigationItem = (item) => {
    if (item.type === 'section') {
      const hasActiveChild = isParentActive(item.items);
      
      return (
        <div key={item.key} className="mb-2">
          <button
            onClick={() => toggleSection(item.key)}
            className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition-colors ${
              hasActiveChild
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-3">
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </div>
            {item.expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          
          {item.expanded && (
            <div className="ml-4 mt-2 space-y-1">
              {item.items.map((subItem) => (
                <Link
                  key={subItem.path}
                  to={subItem.path}
                  className={`flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                    isActive(subItem.path)
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <subItem.icon className="h-4 w-4" />
                  <span>{subItem.label}</span>
                  {subItem.badge && (
                    <span className="ml-auto px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                      {subItem.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Regular navigation item
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
          isActive(item.path)
            ? 'bg-blue-600 text-white'
            : 'text-gray-300 hover:bg-slate-700 hover:text-white'
        }`}
      >
        <item.icon className="h-5 w-5" />
        <div className="flex-1">
          <span className="font-medium">{item.label}</span>
          {item.description && (
            <p className="text-xs text-gray-400 mt-1">{item.description}</p>
          )}
        </div>
        {item.badge && (
          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  // Don't render sidebar on auth pages
  if (location.pathname === '/login' || location.pathname === '/signup') {
    return null;
  }

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-slate-800 text-white shadow-lg z-30 overflow-y-auto">
      {/* Sidebar Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">CC</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">CivicConnect</h1>
            <p className="text-xs text-slate-300">
              {currentUser?.role === 'Admin' ? 'Admin Panel' : 
               currentUser?.role === 'DepartmentStaff' ? 'Staff Portal' : 
               currentUser?.role === 'FieldSupervisor' ? 'Supervisor Panel' :
               'User Portal'}
            </p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {currentUser.fullname?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {currentUser.fullname || 'User'}
            </p>
            <p className="text-xs text-slate-300 truncate">
              {currentUser.department || 'No Department'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="space-y-2 mb-8 p-4">
        {navigationItems.map(renderNavigationItem)}
      </nav>

      {/* Role switching for Admin */}
      {currentUser.role === 'Admin' && (
        <div className="px-4 pt-4 border-t border-slate-600">
          <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide font-medium">
            Switch Views
          </p>
          <div className="space-y-1">
            <Link
              to="/staff-dashboard"
              className="flex items-center space-x-3 px-4 py-2 text-sm text-blue-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Users className="h-4 w-4" />
              <span>Staff View</span>
            </Link>
            <Link
              to="/supervisor-dashboard"
              className="flex items-center space-x-3 px-4 py-2 text-sm text-blue-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Briefcase className="h-4 w-4" />
              <span>Supervisor View</span>
            </Link>
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 w-full px-4 py-3 text-red-300 hover:text-white hover:bg-red-600 rounded-lg transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;