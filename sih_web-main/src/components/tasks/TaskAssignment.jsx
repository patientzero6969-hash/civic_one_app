// src/components/tasks/TaskAssignment.jsx
// Updated to properly support supervisor assignment - FIXED SYNTAX

import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Users, 
  UserPlus, 
  CheckCircle,
  Clock,
  AlertTriangle,
  Activity,
  RefreshCw,
  Eye,
  TrendingUp,
  Building,
  User,
  Shield
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api';
import { ROLES } from '../../utils/constants';

const TaskAssignment = () => {
  const { currentUser } = useAuth();
  const [pendingIssues, setPendingIssues] = useState([]);
  const [availableSupervisors, setAvailableSupervisors] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [workloadStats, setWorkloadStats] = useState(null);
  const [recentUpdates, setRecentUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignmentNotes, setAssignmentNotes] = useState('');

  // Check permissions - allow staff to assign tasks
  const hasAssignPermission = currentUser?.role === 'admin' || currentUser?.role === 'staff' || currentUser?.role === 'supervisor';

  useEffect(() => {
    if (currentUser) {
      loadUserAndData();
    }
  }, [currentUser]);

  const loadUserAndData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('=== DEBUGGING USER AND DATA LOADING ===');
      console.log('Current user:', currentUser);

      // Check permissions
      if (!hasAssignPermission) {
        setError('Access denied! Task assignment permission required.');
        return;
      }

      // Load all data concurrently
      await Promise.all([
        loadPendingIssues(),
        loadAvailableSupervisors(),
        loadAssignments(),
        loadWorkloadStats(),
        loadRecentUpdates()
      ]);

    } catch (err) {
      setError(err.message || 'Failed to load task assignment data');
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingIssues = async () => {
    try {
      console.log('Loading pending issues...');
      console.log('Current user:', currentUser);
      
      const params = new URLSearchParams({ 
        status: 'pending', 
        per_page: '100' 
      });

      if (currentUser.role === 'staff' && currentUser.department) {
        params.append('department', currentUser.department);
      }

      console.log('API call params:', params.toString());
      
      const response = await apiService.get(`/api/issues?${params.toString()}`);
      console.log('API response:', response);
      
      setPendingIssues(response.issues || response.data || []);
    } catch (err) {
      console.error('Error loading pending issues:', err);
      setPendingIssues([]);
    }
  };

  const loadAvailableSupervisors = async () => {
  try {
    console.log('Loading supervisors...');
    
    // FIXED: Use the new dedicated supervisors endpoint
    const params = new URLSearchParams({ available_only: 'true' });
    
    // If user is staff, supervisors will be filtered by department automatically on backend
    if (currentUser.role === 'staff' && currentUser.department) {
      params.append('department', currentUser.department);
    }

    console.log('Fetching supervisors with params:', params.toString());
    
    // FIXED: Use the correct endpoint path
    const response = await apiService.get(`/api/users/supervisors?${params.toString()}`);
    console.log('Supervisors response:', response);
    
    // FIXED: Handle different response formats
    let supervisorList = [];
    if (Array.isArray(response)) {
      supervisorList = response;
    } else if (response.supervisors) {
      supervisorList = response.supervisors;
    } else if (response.data) {
      supervisorList = response.data;
    }
    
    console.log('Supervisor list:', supervisorList);
    
    setAvailableSupervisors(supervisorList);
    
  } catch (err) {
    console.error('Error loading available supervisors:', err);
    // Don't fail silently - show empty list but don't crash
    setAvailableSupervisors([]);
  }
};

  const loadAssignments = async () => {
    try {
      const params = new URLSearchParams();
      
      // Filter assignments based on user role
      if (currentUser.role === 'staff' && currentUser.department) {
        params.append('department', currentUser.department);
      }

      const response = await apiService.get(`/api/assignments?${params.toString()}`);
      setAssignments(response.assignments || response.data || []);
    } catch (err) {
      console.error('Error loading assignments:', err);
      setAssignments([]);
    }
  };

  const loadWorkloadStats = async () => {
  try {
    const response = await apiService.get('/api/assignments/stats/workload');
    setWorkloadStats(response);
  } catch (err) {
    console.error('Error loading workload stats:', err);
    // Set default empty stats instead of crashing
    setWorkloadStats({
      total_staff: 0,
      total_supervisors: 0,
      total_active_assignments: 0,
      avg_workload: 0
    });
  }
};

  const loadRecentUpdates = async () => {
  try {
    const response = await apiService.get('/api/updates/recent?limit=10');
    setRecentUpdates(response.updates || response.data || []);
  } catch (err) {
    console.error('Error loading recent updates:', err);
    // Set empty array instead of crashing
    setRecentUpdates([]);
  }
};

  const handleAssignTask = async (issueId, supervisorId, notes = '') => {
  try {
    console.log('=== ASSIGNMENT DEBUG ===');
    console.log('Issue ID:', issueId);
    console.log('Supervisor ID:', supervisorId);
    console.log('Current User:', currentUser);
    
    // Validate inputs
    if (!supervisorId) {
      setMessage('Please select a supervisor');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    if (!issueId) {
      setMessage('Invalid issue ID');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    // Prepare assignment data WITHOUT notes field
    const assignmentData = {
      issue_id: parseInt(issueId),
      staff_id: supervisorId
      // REMOVED: notes field completely
    };
    
    console.log('Assignment payload:', assignmentData);
    
    // Make API call
    const response = await apiService.post('/api/assignments/', assignmentData);
    
    console.log('Assignment response:', response);
    
    setMessage('✅ Task assigned to supervisor successfully!');
    
    // Reload data
    await Promise.all([
      loadPendingIssues(),
      loadAvailableSupervisors(),
      loadAssignments()
    ]);
    
    // Clear message after 3 seconds
    setTimeout(() => setMessage(''), 3000);
    
  } catch (err) {
    console.error('=== ASSIGNMENT ERROR ===');
    console.error('Full error:', err);
    console.error('Error message:', err.message);
    console.error('Error response:', err.data);
    
    // Extract meaningful error message
    let errorMessage = 'Failed to assign task';
    
    if (err.data && err.data.detail) {
      errorMessage = err.data.detail;
    } else if (err.message) {
      errorMessage = err.message;
    }
    
    setMessage(`❌ ${errorMessage}`);
    setTimeout(() => setMessage(''), 5000);
  }
};

  const handleShowAssignModal = (issue) => {
    setSelectedIssue(issue);
    setShowAssignModal(true);
    setAssignmentNotes('');
  };

  const handleCloseAssignModal = () => {
    setShowAssignModal(false);
    setSelectedIssue(null);
    setAssignmentNotes('');
  };

  // Add a test function to check API connectivity
  const testAPIConnectivity = async () => {
    try {
      console.log('=== TESTING API CONNECTIVITY ===');
      
      // Test basic users endpoint
      const usersResponse = await apiService.get('/api/users?per_page=5');
      console.log('Users API test:', usersResponse);
      
      // Test assignable users endpoint
      const assignableResponse = await apiService.get('/api/assignments/assignable-users');
      console.log('Assignable users API test:', assignableResponse);
      
      // Test supervisor filtering
      const supervisorResponse = await apiService.get('/api/users?role=supervisor');
      console.log('Supervisor API test:', supervisorResponse);
      
      console.log('=== API CONNECTIVITY TESTS PASSED ===');
    } catch (err) {
      console.error('=== API CONNECTIVITY TEST FAILED ===');
      console.error(err);
    }
  };

  // Call this in useEffect for initial debugging
  useEffect(() => {
    if (currentUser && process.env.NODE_ENV === 'development') {
      testAPIConnectivity();
    }
  }, [currentUser]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Task Assignment</h1>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Issues */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <ClipboardList className="h-5 w-5 mr-2" />
            Pending Issues ({pendingIssues.length})
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {pendingIssues.map((issue) => (
              <div key={issue.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <h3 className="font-medium text-gray-900">{issue.title}</h3>
                <p className="text-sm text-gray-600 mb-2">{issue.category}</p>
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{issue.description}</p>
                <button
                  onClick={() => handleShowAssignModal(issue)}
                  className="w-full bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
                >
                  Assign Task
                </button>
              </div>
            ))}
            {pendingIssues.length === 0 && (
              <p className="text-gray-500 text-center py-4">No pending issues</p>
            )}
          </div>
        </div>

        {/* Available Supervisors */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Available Supervisors ({availableSupervisors.length})
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {availableSupervisors.map((supervisor) => (
              <div key={supervisor.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{supervisor.full_name}</h3>
                  <span className={`px-2 py-1 rounded text-xs ${
                    supervisor.is_available ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {supervisor.is_available ? 'Available' : 'Busy'}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{supervisor.department}</p>
                <p className="text-sm text-gray-500">
                  Active tasks: {supervisor.active_assignments}
                </p>
              </div>
            ))}
            {availableSupervisors.length === 0 && (
              <div className="text-center py-4">
                <p className="text-gray-500">No supervisors found</p>
                <p className="text-sm text-gray-400 mt-2">
                  Check if supervisors exist in your department
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Assignments */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Recent Assignments
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {assignments.slice(0, 10).map((assignment) => (
              <div key={assignment.id} className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900">{assignment.issue_title}</h3>
                <p className="text-sm text-gray-600">
                  Assigned to: {assignment.staff_name} ({assignment.staff_role})
                </p>
                <p className="text-sm text-gray-500">
                  Status: {assignment.status}
                </p>
              </div>
            ))}
            {assignments.length === 0 && (
              <p className="text-gray-500 text-center py-4">No recent assignments</p>
            )}
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && selectedIssue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Assign Task: {selectedIssue.title}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Supervisor
                </label>
                <select
                  id="supervisor-select"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue=""
                >
                  <option value="" disabled>Choose a supervisor...</option>
                  {availableSupervisors.map((supervisor) => (
                    <option key={supervisor.id} value={supervisor.id}>
                      {supervisor.full_name} ({supervisor.department}) - {supervisor.active_assignments} active tasks
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assignment Notes (Optional)
                </label>
                <textarea
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Add any specific instructions or notes..."
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleCloseAssignModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const supervisorSelect = document.getElementById('supervisor-select');
                    const selectedSupervisorId = supervisorSelect.value;
                    
                    if (!selectedSupervisorId) {
                      alert('Please select a supervisor');
                      return;
                    }
                    
                    handleAssignTask(selectedIssue.id, selectedSupervisorId, assignmentNotes);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Assign Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskAssignment;