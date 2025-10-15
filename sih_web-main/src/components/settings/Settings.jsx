import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Cog, 
  UserPlus,
  Save,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Building,
  Shield,
  Database
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api';
import { ROLES } from '../../utils/constants';

const Settings = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    password: '',
    role: '',
    department: ''
  });
  const [userStats, setUserStats] = useState({
    total_users: 0,
    citizens: 0,
    staff: 0,
    supervisors: 0,
    admins: 0
  });

  // Role labels based on your backend roles
  const ROLE_LABELS = {
    [ROLES.CITIZEN]: 'Citizen',
    [ROLES.STAFF]: 'Staff',
    [ROLES.SUPERVISOR]: 'Supervisor',
    [ROLES.ADMIN]: 'Administrator'
  };

  const roles = [
    { value: ROLES.CITIZEN, label: ROLE_LABELS[ROLES.CITIZEN] },
    { value: ROLES.STAFF, label: ROLE_LABELS[ROLES.STAFF] },
    { value: ROLES.SUPERVISOR, label: ROLE_LABELS[ROLES.SUPERVISOR] },
    { value: ROLES.ADMIN, label: ROLE_LABELS[ROLES.ADMIN] }
  ];

  // Department names from your backend
  const DEPARTMENT_OPTIONS = [
    'Road Department',
    'Electricity Department', 
    'Sanitary Department',
    'Public Service'
  ];

  // Check permissions based on your backend RBAC
  const hasManageUsersPermission = currentUser?.role === ROLES.ADMIN;

  useEffect(() => {
    if (currentUser) {
      loadInitialData();
    }
  }, [currentUser]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Check if user has admin role (only admins can manage users in your backend)
      if (!currentUser || currentUser.role !== ROLES.ADMIN) {
        setMessage('Access denied! Administrator privileges required.');
        return;
      }

      // Load users, departments, and stats
      await Promise.all([
        loadUsers(),
        loadDepartments(),
        loadUserStats()
      ]);

    } catch (err) {
      setMessage(`Error: ${err.message}`);
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      // Use your backend API endpoint
      const response = await apiService.get('/api/users?per_page=100');
      setUsers(response.users || response.data || response || []);
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsers([]);
    }
  };

  const loadDepartments = async () => {
    // Use hardcoded departments based on your backend structure
    setDepartments(DEPARTMENT_OPTIONS);
  };

  const loadUserStats = async () => {
    try {
      // Use your backend stats endpoint
      const response = await apiService.get('/api/users/stats');
      setUserStats({
        total_users: response.total_users || 0,
        citizens: response.citizens || 0,
        staff: response.staff || 0,
        supervisors: response.supervisors || 0,
        admins: response.admins || 0
      });
    } catch (err) {
      console.error('Failed to load user stats:', err);
      setUserStats({
        total_users: 0,
        citizens: 0,
        staff: 0,
        supervisors: 0,
        admins: 0
      });
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!newUser.full_name || !newUser.email || !newUser.role || !newUser.password) {
      setMessage('Please fill in all required fields.');
      return;
    }

    // Check if department is required for staff/supervisor roles (from your backend logic)
    if ((newUser.role === ROLES.STAFF || newUser.role === ROLES.SUPERVISOR) && !newUser.department) {
      setMessage('Please select a department for this role.');
      return;
    }

    try {
      // Create user using your backend registration endpoint with role
      const userData = {
        email: newUser.email,
        password: newUser.password,
        full_name: newUser.full_name,
        role: newUser.role
      };

      // Add department if specified (for staff/supervisor)
      if (newUser.department) {
        userData.department = newUser.department;
      }

      // Use your backend auth/register endpoint that supports role assignment
      await apiService.post('/api/auth/register', userData);

      setMessage('User created successfully!');
      setNewUser({ full_name: '', email: '', role: '', password: '', department: '' });
      
      // Reload data
      await Promise.all([loadUsers(), loadUserStats()]);
      
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.detail || err.message}`);
    }

    setTimeout(() => setMessage(''), 5000);
  };

  const handleChangeUserRole = async (userId, newRole) => {
    if (!window.confirm('Are you sure you want to change this user\'s role?')) {
      return;
    }

    try {
      // Use your backend change role endpoint
      await apiService.post(`/api/users/${userId}/change-role`, { new_role: newRole });
      setMessage('User role updated successfully!');
      await Promise.all([loadUsers(), loadUserStats()]);
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.detail || err.message}`);
    }

    setTimeout(() => setMessage(''), 3000);
  };

  // User deletion removed - not needed for this application

  const getRoleColor = (role) => {
    switch (role) {
      case ROLES.ADMIN:
        return 'bg-red-100 text-red-800';
      case ROLES.SUPERVISOR:
        return 'bg-blue-100 text-blue-800';
      case ROLES.STAFF:
        return 'bg-green-100 text-green-800';
      case ROLES.CITIZEN:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || !hasManageUsersPermission) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-center">
            <AlertCircle className="h-6 w-6 inline mr-2" />
            Access denied! Administrator privileges required.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
              <p className="text-gray-600">Manage users and system configuration</p>
            </div>
            <button
              onClick={loadInitialData}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Success/Error Messages */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.includes('successfully') || message.includes('updated')
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center">
              {message.includes('successfully') ? (
                <Save className="h-5 w-5 mr-2" />
              ) : (
                <AlertCircle className="h-5 w-5 mr-2" />
              )}
              {message}
            </div>
          </div>
        )}

        {/* User Statistics */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Users</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{userStats.total_users}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-gray-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Citizens</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{userStats.citizens}</p>
              </div>
              <Users className="h-8 w-8 text-gray-500" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Staff</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{userStats.staff}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Supervisors</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{userStats.supervisors}</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Admins</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{userStats.admins}</p>
              </div>
              <Shield className="h-8 w-8 text-red-500" />
            </div>
          </div>
        </section>

        {/* User Management Section */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <UserPlus className="h-6 w-6 text-blue-500 mr-2" />
            User Management
          </h3>
          
          {/* Add User Form */}
          <form onSubmit={handleAddUser} className="mb-8">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Create New User</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <input
                type="text"
                placeholder="Full Name *"
                value={newUser.full_name}
                onChange={(e) => setNewUser({...newUser, full_name: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <input
                type="email"
                placeholder="Email *"
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({...newUser, role: e.target.value, department: e.target.value === ROLES.CITIZEN ? '' : newUser.department})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Role *</option>
                {roles.map(role => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password *"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {(newUser.role === ROLES.STAFF || newUser.role === ROLES.SUPERVISOR) && (
                <select
                  value={newUser.department}
                  onChange={(e) => setNewUser({...newUser, department: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Department *</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              )}
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center justify-center"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Create User
              </button>
            </div>
          </form>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <h4 className="text-lg font-medium text-gray-900 mb-4">System Users ({users.length})</h4>
            {users.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No users found</p>
              </div>
            ) : (
              <table className="w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.full_name || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.phone || 'No phone'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                          {ROLE_LABELS[user.role] || user.role || 'citizen'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <Building className="h-4 w-4 text-gray-400 mr-2" />
                          {user.department || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <select
                          onChange={(e) => e.target.value && handleChangeUserRole(user.id, e.target.value)}
                          className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          defaultValue=""
                          disabled={user.id === currentUser?.id}
                        >
                          <option value="">Change Role</option>
                          {roles.filter(role => role.value !== user.role).map(role => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* System Information */}
        <section className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <Cog className="h-6 w-6 text-gray-500 mr-2" />
            System Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                <Database className="h-5 w-5 mr-2" />
                Backend Status
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">API Version:</span>
                  <span className="text-gray-900">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Authentication:</span>
                  <span className="text-green-600">Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Your Role:</span>
                  <span className="text-blue-600">{ROLE_LABELS[currentUser?.role] || currentUser?.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Department:</span>
                  <span className="text-gray-900">{currentUser?.department || 'N/A'}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                <Building className="h-5 w-5 mr-2" />
                Available Departments
              </h4>
              <div className="space-y-1 text-sm">
                {departments.length === 0 ? (
                  <p className="text-gray-500">Loading departments...</p>
                ) : (
                  departments.map((dept, index) => (
                    <div key={index} className="flex items-center">
                      <Building className="h-3 w-3 text-gray-400 mr-2" />
                      <span className="text-gray-900">{dept}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Role Capabilities
              </h4>
              <div className="space-y-1 text-sm">
                <div className="flex items-center">
                  <span className="text-gray-600">Manage Users:</span>
                  <span className={`ml-2 ${currentUser?.role === ROLES.ADMIN ? 'text-green-600' : 'text-red-600'}`}>
                    {currentUser?.role === ROLES.ADMIN ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-600">Assign Tasks:</span>
                  <span className={`ml-2 ${[ROLES.ADMIN, ROLES.SUPERVISOR].includes(currentUser?.role) ? 'text-green-600' : 'text-red-600'}`}>
                    {[ROLES.ADMIN, ROLES.SUPERVISOR].includes(currentUser?.role) ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-600">View Analytics:</span>
                  <span className={`ml-2 ${[ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.STAFF].includes(currentUser?.role) ? 'text-green-600' : 'text-red-600'}`}>
                    {[ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.STAFF].includes(currentUser?.role) ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-600">Create Issues:</span>
                  <span className="ml-2 text-green-600">Yes</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Settings;