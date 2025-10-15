import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  FileText,
  Activity,
  RefreshCw,
  Settings,
  LogOut,
  Home,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Briefcase,
  Plus,
  Edit,
  Trash2,
  Eye,
  Filter,
  Search,
  Download,
  X,
  ArrowUpCircle,
  MessageCircle// Added for Escalation icon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { ROLES, API_ENDPOINTS, getDashboardRoute } from '../../utils/constants';

const AdminDashboard = () => {
  const { currentUser, apiCall, logout } = useAuth();
  const navigate = useNavigate();
  
  // State management
  const [dashboardData, setDashboardData] = useState({
    totalIssues: 0,
    pendingIssues: 0,
    resolvedIssues: 0,
    inProgressIssues: 0,
    activeUsers: 0,
    totalUsers: 0,
    departmentStats: [],
    monthlyTrends: []
  });
  const [recentIssues, setRecentIssues] = useState([]);
  const [recentAssignments, setRecentAssignments] = useState([]);
  const [recentUpdates, setRecentUpdates] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchAllDashboardData();
  }, []);

  const fetchAllDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Verify admin access
      if (!currentUser || currentUser.role !== ROLES.ADMIN) {
        setError('Access denied. Administrator privileges required.');
        return;
      }

      // Load data using existing endpoints that work
      await Promise.allSettled([
        loadBasicStats(),
        loadRecentIssues(),
        loadRecentAssignments(), 
        loadRecentUpdates(),
        loadUsers()
      ]);

    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Use existing working endpoints instead of non-existent analytics endpoints
  const loadBasicStats = async () => {
    try {
      // Get basic stats from existing endpoints
      let totalIssues = 0;
      let pendingIssues = 0;
      let resolvedIssues = 0;
      let totalUsers = 0;

      // Try to get issues count (use existing endpoint)
      try {
        const issuesResponse = await apiCall(`${API_ENDPOINTS.ISSUES.LIST}?per_page=1`);
        if (issuesResponse && issuesResponse.ok) {
          const issuesData = await issuesResponse.json();
          totalIssues = issuesData.total || 0;
        }
      } catch (err) {
        console.log('Could not load issues stats:', err);
      }

      // Try to get pending issues
      try {
        const pendingResponse = await apiCall(`${API_ENDPOINTS.ISSUES.LIST}?status=pending&per_page=1`);
        if (pendingResponse && pendingResponse.ok) {
          const pendingData = await pendingResponse.json();
          pendingIssues = pendingData.total || 0;
        }
      } catch (err) {
        console.log('Could not load pending issues:', err);
      }

      // Try to get resolved issues
      try {
        const resolvedResponse = await apiCall(`${API_ENDPOINTS.ISSUES.LIST}?status=resolved&per_page=1`);
        if (resolvedResponse && resolvedResponse.ok) {
          const resolvedData = await resolvedResponse.json();
          resolvedIssues = resolvedData.total || 0;
        }
      } catch (err) {
        console.log('Could not load resolved issues:', err);
      }

      // Try to get users count
      try {
        const usersResponse = await apiCall(`${API_ENDPOINTS.USERS.LIST}?per_page=1`);
        if (usersResponse && usersResponse.ok) {
          const usersData = await usersResponse.json();
          totalUsers = usersData.total || 0;
        }
      } catch (err) {
        console.log('Could not load users stats:', err);
      }

      // Set the dashboard data with available stats
      setDashboardData({
        totalIssues,
        pendingIssues,
        resolvedIssues,
        inProgressIssues: Math.max(0, totalIssues - pendingIssues - resolvedIssues),
        activeUsers: Math.floor(totalUsers * 0.3), // Estimate 30% active users
        totalUsers,
        departmentStats: [], // We'll populate this with mock data for now
        monthlyTrends: [] // We'll populate this with mock data for now
      });

    } catch (err) {
      console.error('Failed to load basic stats:', err);
      // Set default empty data
      setDashboardData({
        totalIssues: 0,
        pendingIssues: 0,
        resolvedIssues: 0,
        inProgressIssues: 0,
        activeUsers: 0,
        totalUsers: 0,
        departmentStats: [],
        monthlyTrends: []
      });
    }
  };

  const loadRecentIssues = async () => {
    try {
      const response = await apiCall(`${API_ENDPOINTS.ISSUES.LIST}?limit=5&sort=created_at&order=desc`);
      if (response && response.ok) {
        const data = await response.json();
        setRecentIssues(data.issues || data.data || []);
      }
    } catch (err) {
      console.error('Failed to load recent issues:', err);
      setRecentIssues([]);
    }
  };

  const loadRecentAssignments = async () => {
    try {
      const response = await apiCall(`${API_ENDPOINTS.ASSIGNMENTS.LIST}?limit=5&sort=assigned_at&order=desc`);
      if (response && response.ok) {
        const data = await response.json();
        setRecentAssignments(data.assignments || data.data || []);
      }
    } catch (err) {
      console.error('Failed to load recent assignments:', err);
      setRecentAssignments([]);
    }
  };

  const loadRecentUpdates = async () => {
    try {
      const response = await apiCall(`${API_ENDPOINTS.UPDATES.RECENT}?limit=5`);
      if (response && response.ok) {
        const data = await response.json();
        setRecentUpdates(data.updates || data.data || []);
      }
    } catch (err) {
      console.error('Failed to load recent updates:', err);
      setRecentUpdates([]);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await apiCall(`${API_ENDPOINTS.USERS.LIST}?limit=10&sort=created_at&order=desc`);
      if (response && response.ok) {
        const data = await response.json();
        setUsers(data.users || data.data || []);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsers([]);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/login');
    }
  };

  const handleRefresh = () => {
    fetchAllDashboardData();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return 'Invalid Date';
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'text-green-600',
      medium: 'text-yellow-600',
      high: 'text-orange-600',
      critical: 'text-red-600'
    };
    return colors[priority] || 'text-gray-600';
  };

  const sidebarItems = [
    {
      title: 'Overview',
      icon: Home,
      key: 'overview',
      path: '/admin-dashboard'
    },
    {
      title: 'Issues Management',
      icon: FileText,
      key: 'issues',
      submenu: [
        { title: 'All Issues', path: '/issues', icon: FileText },
        { title: 'Pending Issues', path: '/issues?status=pending', icon: Clock },
        { title: 'Critical Issues', path: '/issues?priority=critical', icon: AlertTriangle },
      ]
    },
    {
      title: 'Task Assignment',
      icon: ClipboardList,
      key: 'assignments',
      path: '/task-assignment'
    },
    {
      title: 'Escalation',
      icon: ArrowUpCircle,
      key: 'escalation',
      path: '/escalation'
    },
    {
      title: 'Analytics',
      icon: BarChart3,
      key: 'analytics',
      path: '/analytics'
    },
    {
      title: 'System Settings',
      icon: Settings,
      key: 'settings',
      path: '/settings'
    },
    {
      title: 'AI Assistant',
      icon: MessageCircle,
      key: 'chatbot',
      path: '/chatbot',
      badge: 'new'
  }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Dashboard Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <AdminSidebar 
        items={sidebarItems}
        collapsed={sidebarCollapsed}
        onCollapse={setSidebarCollapsed}
        currentUser={currentUser}
        onLogout={handleLogout}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content */}
      <div className={`flex-1 ${sidebarCollapsed ? 'ml-16' : 'ml-64'} transition-all duration-300`}>
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-gray-600">System overview and management</p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleRefresh}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </button>
                <span className="text-sm text-gray-600">
                  Welcome, <strong>{currentUser?.fullname || 'Admin'}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <OverviewTab 
              dashboardData={dashboardData}
              recentIssues={recentIssues}
              recentAssignments={recentAssignments}
              recentUpdates={recentUpdates}
              formatDate={formatDate}
              getStatusColor={getStatusColor}
              getPriorityColor={getPriorityColor}
            />
          )}
          
          {activeTab === 'users' && (
            <UsersTab 
              users={users}
              onUserSelect={setSelectedUser}
              onShowModal={setShowUserModal}
              formatDate={formatDate}
            />
          )}

          {activeTab === 'issues' && (
            <IssuesTab 
              recentIssues={recentIssues}
              dashboardData={dashboardData}
              formatDate={formatDate}
              getStatusColor={getStatusColor}
              getPriorityColor={getPriorityColor}
            />
          )}
        </div>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <UserModal 
          user={selectedUser}
          onClose={() => {
            setShowUserModal(false);
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
};

// Sidebar Component
const AdminSidebar = ({ items, collapsed, onCollapse, currentUser, onLogout, activeTab, onTabChange }) => {
  const [openSubmenu, setOpenSubmenu] = useState({});
  const navigate = useNavigate();

  const toggleSubmenu = (key) => {
    setOpenSubmenu(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleItemClick = (item) => {
    if (item.submenu) {
      toggleSubmenu(item.key);
    } else if (item.path) {
      navigate(item.path);
    } else {
      onTabChange(item.key);
    }
  };

  const handleSubmenuClick = (subitem) => {
    if (subitem.onClick) {
      subitem.onClick();
    } else if (subitem.path) {
      navigate(subitem.path);
    }
  };

  return (
    <div className={`fixed left-0 top-0 h-full bg-slate-800 text-white transition-all duration-300 z-40 ${
      collapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div>
              <h2 className="text-xl font-bold">Admin Panel</h2>
              <p className="text-xs text-slate-400">System Management</p>
            </div>
          )}
          <button
            onClick={() => onCollapse(!collapsed)}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* User Info */}
      {!collapsed && (
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {currentUser?.fullname || 'Administrator'}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {currentUser?.email}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Items */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.key}>
              <button
                onClick={() => handleItemClick(item)}
                className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
                  activeTab === item.key 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <item.icon className={`h-5 w-5 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.title}</span>
                    {item.submenu && (
                      <ChevronDown 
                        className={`h-4 w-4 transition-transform ${
                          openSubmenu[item.key] ? 'rotate-180' : ''
                        }`} 
                      />
                    )}
                  </>
                )}
              </button>

              {/* Submenu */}
              {item.submenu && !collapsed && openSubmenu[item.key] && (
                <div className="ml-6 mt-2 space-y-1">
                  {item.submenu.map((subitem, index) => (
                    <button
                      key={index}
                      onClick={() => handleSubmenuClick(subitem)}
                      className="w-full flex items-center px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <subitem.icon className="h-4 w-4 mr-2" />
                      {subitem.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-slate-700">
        <button
          onClick={onLogout}
          className="w-full flex items-center px-3 py-2 text-slate-300 hover:bg-red-600 hover:text-white rounded-lg transition-colors"
        >
          <LogOut className={`h-5 w-5 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ 
  dashboardData, 
  recentIssues, 
  recentAssignments, 
  recentUpdates, 
  formatDate, 
  getStatusColor, 
  getPriorityColor 
}) => (
  <div className="space-y-6">
    {/* Stats Overview */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Total Issues"
        value={dashboardData?.totalIssues || 0}
        icon={FileText}
        color="blue"
      />
      <StatCard
        title="Pending Issues"
        value={dashboardData?.pendingIssues || 0}
        icon={Clock}
        color="yellow"
      />
      <StatCard
        title="Resolved Issues"
        value={dashboardData?.resolvedIssues || 0}
        icon={CheckCircle}
        color="green"
      />
      <StatCard
        title="Total Users"
        value={dashboardData?.totalUsers || 0}
        icon={Users}
        color="purple"
      />
    </div>

    {/* Recent Activity */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Recent Issues */}
      <ActivityCard
        title="Recent Issues"
        icon={FileText}
        items={recentIssues}
        renderItem={(issue) => (
          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="font-medium text-gray-900 truncate">
              {issue.title || 'Untitled Issue'}
            </h4>
            <div className="flex items-center justify-between mt-1">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(issue.status)}`}>
                {issue.status || 'unknown'}
              </span>
              <span className="text-xs text-gray-500">
                {formatDate(issue.created_at)}
              </span>
            </div>
          </div>
        )}
        emptyMessage="No recent issues"
      />

      {/* Recent Assignments */}
      <ActivityCard
        title="Recent Assignments"
        icon={ClipboardList}
        items={recentAssignments}
        renderItem={(assignment) => (
          <div className="border-l-4 border-yellow-500 pl-4">
            <h4 className="font-medium text-gray-900 truncate">
              {assignment.issue_title || `Issue #${assignment.issue_id}`}
            </h4>
            <p className="text-sm text-gray-600">
              Assigned to: {assignment.staff_name || 'Unknown'}
            </p>
            <p className="text-xs text-gray-500">
              {formatDate(assignment.assigned_at)}
            </p>
          </div>
        )}
        emptyMessage="No recent assignments"
      />

      {/* Recent Updates */}
      <ActivityCard
        title="Recent Updates"
        icon={Activity}
        items={recentUpdates}
        renderItem={(update) => (
          <div className="border-l-4 border-green-500 pl-4">
            <p className="text-sm text-gray-900">
              {update.update_text || 'Update available'}
            </p>
            <p className="text-xs text-gray-500">
              {formatDate(update.created_at)}
            </p>
          </div>
        )}
        emptyMessage="No recent updates"
      />
    </div>

    {/* System Summary */}
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
        <BarChart3 className="h-5 w-5 mr-2" />
        System Summary
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {dashboardData.totalIssues > 0 ? Math.round((dashboardData.resolvedIssues / dashboardData.totalIssues) * 100) : 0}%
          </div>
          <div className="text-sm text-gray-600">Resolution Rate</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{dashboardData.activeUsers}</div>
          <div className="text-sm text-gray-600">Active Users</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">{dashboardData.inProgressIssues}</div>
          <div className="text-sm text-gray-600">In Progress</div>
        </div>
      </div>
    </div>
  </div>
);

// Users Tab Component (simplified)
const UsersTab = ({ users, onUserSelect, onShowModal, formatDate }) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-semibold text-gray-900">User Management</h2>
      <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center">
        <Plus className="h-4 w-4 mr-2" />
        Add User
      </button>
    </div>

    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">All Users</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.length > 0 ? users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.full_name || user.fullname || 'Unknown User'}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                    user.role === 'staff' ? 'bg-blue-100 text-blue-800' :
                    user.role === 'supervisor' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {user.role || 'citizen'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.department || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(user.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => {
                        onUserSelect(user);
                        onShowModal(true);
                      }}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="text-blue-600 hover:text-blue-900">
                      <Edit className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// Issues Tab Component (simplified) - Removed "Create Issue" button
const IssuesTab = ({ recentIssues, dashboardData, formatDate, getStatusColor, getPriorityColor }) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-semibold text-gray-900">Issues Management</h2>
      <div className="flex space-x-2">
        <Link to="/issues" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          View All Issues
        </Link>
      </div>
    </div>

    {/* Issue Stats */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Issues</p>
            <p className="text-2xl font-bold text-gray-900">{dashboardData?.totalIssues || 0}</p>
          </div>
          <FileText className="h-8 w-8 text-blue-500" />
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{dashboardData?.pendingIssues || 0}</p>
          </div>
          <Clock className="h-8 w-8 text-yellow-500" />
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">In Progress</p>
            <p className="text-2xl font-bold text-blue-600">{dashboardData?.inProgressIssues || 0}</p>
          </div>
          <Activity className="h-8 w-8 text-blue-500" />
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Resolved</p>
            <p className="text-2xl font-bold text-green-600">{dashboardData?.resolvedIssues || 0}</p>
          </div>
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
      </div>
    </div>

    {/* Recent Issues Table */}
    <div className="bg-white rounded-xl shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Recent Issues</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {recentIssues.length > 0 ? recentIssues.map((issue) => (
              <tr key={issue.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {issue.title || 'Untitled Issue'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {issue.description?.substring(0, 50)}...
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(issue.status)}`}>
                    {issue.status || 'pending'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`text-sm font-medium ${getPriorityColor(issue.priority)}`}>
                    {issue.priority || 'medium'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {issue.category || 'General'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(issue.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button className="text-indigo-600 hover:text-indigo-900">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="text-blue-600 hover:text-blue-900">
                      <Edit className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  No issues found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// Reusable Components
const StatCard = ({ title, value, icon: Icon, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500'
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
        </div>
        <div className={`${colorClasses[color]} p-3 rounded-full`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
};

const ActivityCard = ({ title, icon: Icon, items, renderItem, emptyMessage }) => (
  <div className="bg-white rounded-xl shadow-sm">
    <div className="px-6 py-4 border-b border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
        <Icon className="h-5 w-5 mr-2" />
        {title}
      </h3>
    </div>
    <div className="p-6">
      {items && items.length > 0 ? (
        <div className="space-y-4">
          {items.slice(0, 5).map((item, index) => (
            <div key={item.id || index}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Icon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">{emptyMessage}</p>
        </div>
      )}
    </div>
  </div>
);

const UserModal = ({ user, onClose }) => {
  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">User Details</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600">Name</label>
            <p className="text-gray-900">{user.full_name || user.fullname || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Email</label>
            <p className="text-gray-900">{user.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Role</label>
            <p className="text-gray-900 capitalize">{user.role}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Department</label>
            <p className="text-gray-900">{user.department || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Phone</label>
            <p className="text-gray-900">{user.phone || 'N/A'}</p>
          </div>
        </div>

        <div className="mt-6 flex space-x-2">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex-1">
            Edit User
          </button>
          <button 
            onClick={onClose}
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;