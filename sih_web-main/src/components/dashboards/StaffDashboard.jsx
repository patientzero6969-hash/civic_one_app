import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";
import Sidebar from '../common/Sidebar';
import LoadingSpinner from '../common/LoadingSpinner';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  Users, 
  Play, 
  Check, 
  FileText,
  RefreshCw,
  UserPlus,
  TrendingUp,
  Briefcase,
  Eye,
  Edit
} from 'lucide-react';
import apiService from '../../services/api';

const StaffDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [myAssignments, setMyAssignments] = useState([]);
  const [departmentIssues, setDepartmentIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch MY assignments using the correct backend endpoint
      const [assignmentsResponse, issuesResponse] = await Promise.allSettled([
        apiService.get('/api/assignments/my'),
        apiService.get('/api/issues?per_page=50')
      ]);
      
      // Handle assignments data
      if (assignmentsResponse.status === 'fulfilled' && assignmentsResponse.value) {
        const assignmentsData = assignmentsResponse.value;
        setMyAssignments(assignmentsData.assignments || assignmentsData.data || []);
      } else {
        console.error('Failed to fetch assignments:', assignmentsResponse.reason);
        setMyAssignments([]);
      }
      
      // Handle issues data
      if (issuesResponse.status === 'fulfilled' && issuesResponse.value) {
        const issuesData = issuesResponse.value;
        setDepartmentIssues(issuesData.issues || issuesData.data || []);
      } else {
        console.error('Failed to fetch issues:', issuesResponse.reason);
        setDepartmentIssues([]);
      }

    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchDashboardData();
      
      // Auto-refresh every 2 minutes for staff dashboard
      const interval = setInterval(fetchDashboardData, 2 * 60 * 1000);
      
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const handleUpdateAssignmentStatus = async (assignmentId, newStatus) => {
    setActionLoading(assignmentId);
    try {
      // Use your backend assignment update endpoint
      const response = await apiService.put(`/api/assignments/${assignmentId}`, {
        status: newStatus
      });

      if (response) {
        alert(`Assignment status updated to ${newStatus.replace('_', ' ')}!`);
        fetchDashboardData(); // Refresh data
      } else {
        throw new Error('Update failed');
      }
    } catch (err) {
      console.error('Assignment status update error:', err);
      alert('Status update failed: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddUpdate = async (issueId) => {
    const updateText = prompt('Enter your update for this issue:');
    if (updateText && updateText.trim()) {
      try {
        setActionLoading(issueId);
        // Use your backend updates endpoint
        const response = await apiService.post('/api/updates', {
          issue_id: issueId,
          update_text: updateText.trim()
        });

        if (response) {
          alert('Update added successfully!');
          fetchDashboardData();
        } else {
          throw new Error('Update creation failed');
        }
      } catch (err) {
        console.error('Update error:', err);
        alert('Failed to add update: ' + err.message);
      } finally {
        setActionLoading(null);
      }
    }
  };

  // Navigation handlers - these should navigate to the correct routes
  const handleNavigateToAssignments = () => {
    navigate('/assignments');
  };

  const handleNavigateToIssues = () => {
    navigate('/issues');
  };

  const handleNavigateToTaskManagement = () => {
    navigate('/task-assignment');
  };

  const handleNavigateToUpdates = () => {
    navigate('/updates');
  };

  const handleViewIssueDetails = (issueId) => {
    navigate(`/issues/${issueId}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 ml-60 p-6">
          <LoadingSpinner size="large" text="Loading department dashboard..." />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 ml-60 p-6">
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load dashboard</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchDashboardData}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Calculate assignment stats
  const assignmentStats = {
    total: myAssignments.length,
    assigned: myAssignments.filter(a => a.status === 'assigned').length,
    inProgress: myAssignments.filter(a => a.status === 'in_progress').length,
    completed: myAssignments.filter(a => a.status === 'completed').length
  };

  // Calculate issue stats (for issues visible to staff)
  const issueStats = {
    total: departmentIssues.length,
    pending: departmentIssues.filter(i => i.status === 'pending').length,
    inProgress: departmentIssues.filter(i => i.status === 'in_progress').length,
    resolved: departmentIssues.filter(i => i.status === 'resolved').length
  };

  const StatCard = ({ title, value, icon: Icon, color, bgColor, onClick }) => (
    <div 
      className={`${bgColor} rounded-xl p-6 shadow-sm border-t-4 ${color} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <Icon className={`h-8 w-8 ${color.replace('border-t-', 'text-')}`} />
      </div>
    </div>
  );

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'assigned':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 ml-60 p-6">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Staff Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Welcome, <span className="font-semibold">{currentUser?.full_name}</span>
            </p>
            <p className="text-sm text-gray-500">
              Department: {currentUser?.department || 'Not assigned'}
            </p>
          </div>
          
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </header>

        {/* Stats Cards - Make them clickable */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="My Assignments"
            value={assignmentStats.total}
            icon={Briefcase}
            color="border-t-blue-500 text-blue-500"
            bgColor="bg-white"
            onClick={handleNavigateToAssignments}
          />
          <StatCard
            title="In Progress"
            value={assignmentStats.inProgress}
            icon={Clock}
            color="border-t-yellow-500 text-yellow-500"
            bgColor="bg-white"
            onClick={handleNavigateToAssignments}
          />
          <StatCard
            title="Completed"
            value={assignmentStats.completed}
            icon={CheckCircle}
            color="border-t-green-500 text-green-500"
            bgColor="bg-white"
            onClick={handleNavigateToAssignments}
          />
          <StatCard
            title="Total Issues"
            value={issueStats.total}
            icon={FileText}
            color="border-t-purple-500 text-purple-500"
            bgColor="bg-white"
            onClick={handleNavigateToIssues}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <button
            onClick={handleNavigateToAssignments}
            className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-colors text-left"
          >
            <Briefcase className="h-6 w-6 text-blue-500 mb-2" />
            <div className="text-sm font-medium text-gray-900">My Assignments</div>
            <div className="text-xs text-gray-500">View and manage tasks</div>
          </button>
          
          <button
            onClick={handleNavigateToIssues}
            className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-purple-300 transition-colors text-left"
          >
            <FileText className="h-6 w-6 text-purple-500 mb-2" />
            <div className="text-sm font-medium text-gray-900">Browse Issues</div>
            <div className="text-xs text-gray-500">View all issues</div>
          </button>
          
          <button
            onClick={handleNavigateToUpdates}
            className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-green-300 transition-colors text-left"
          >
            <Edit className="h-6 w-6 text-green-500 mb-2" />
            <div className="text-sm font-medium text-gray-900">Issue Updates</div>
            <div className="text-xs text-gray-500">Add progress updates</div>
          </button>
          
          <button
            onClick={handleNavigateToTaskManagement}
            className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-indigo-300 transition-colors text-left"
          >
            <Users className="h-6 w-6 text-indigo-500 mb-2" />
            <div className="text-sm font-medium text-gray-900">Task Management</div>
            <div className="text-xs text-gray-500">Manage assignments</div>
          </button>
        </div>

        {/* My Assignments Section */}
        <section className="bg-white rounded-xl p-6 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Briefcase className="h-6 w-6 text-blue-500 mr-2" />
              My Assignments ({myAssignments.length})
            </h2>
            <button
              onClick={handleNavigateToAssignments}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View All →
            </button>
          </div>
          
          <div className="overflow-x-auto">
            {myAssignments.length === 0 ? (
              <div className="text-center py-8">
                <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No assignments yet</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {myAssignments.slice(0, 5).map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            #{assignment.issue_id} - {assignment.issue_title || 'Issue Title'}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {assignment.issue_category || 'Category'} • {assignment.notes}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(assignment.status)}`}>
                          {assignment.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatDate(assignment.assigned_at)}
                      </td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <button
                          onClick={() => handleViewIssueDetails(assignment.issue_id)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition-colors inline-flex items-center"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </button>
                        {assignment.status !== 'completed' && (
                          <>
                            {assignment.status === 'assigned' && (
                              <button
                                onClick={() => handleUpdateAssignmentStatus(assignment.id, 'in_progress')}
                                disabled={actionLoading === assignment.id}
                                className="bg-yellow-600 text-white px-3 py-1 rounded text-xs hover:bg-yellow-700 transition-colors disabled:opacity-50 inline-flex items-center"
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Start Work
                              </button>
                            )}
                            {assignment.status === 'in_progress' && (
                              <button
                                onClick={() => handleUpdateAssignmentStatus(assignment.id, 'completed')}
                                disabled={actionLoading === assignment.id}
                                className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors disabled:opacity-50 inline-flex items-center"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Complete
                              </button>
                            )}
                            <button
                              onClick={() => handleAddUpdate(assignment.issue_id)}
                              disabled={actionLoading === assignment.issue_id}
                              className="bg-indigo-600 text-white px-3 py-1 rounded text-xs hover:bg-indigo-700 transition-colors disabled:opacity-50 inline-flex items-center"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Add Update
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Department Issues Overview */}
        <section className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <FileText className="h-6 w-6 text-purple-500 mr-2" />
              Recent Issues ({departmentIssues.length})
            </h2>
            <button
              onClick={handleNavigateToIssues}
              className="text-purple-600 hover:text-purple-800 text-sm font-medium"
            >
              View All Issues →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{issueStats.pending}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{issueStats.inProgress}</div>
              <div className="text-sm text-gray-600">In Progress</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{issueStats.resolved}</div>
              <div className="text-sm text-gray-600">Resolved</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{issueStats.total}</div>
              <div className="text-sm text-gray-600">Total Issues</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {departmentIssues.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No issues available</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {departmentIssues.slice(0, 10).map((issue) => (
                    <tr key={issue.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">#{issue.id} - {issue.title}</div>
                          <div className="text-gray-500 text-xs">{issue.category}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(issue.status)}`}>
                          {issue.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium ${getPriorityColor(issue.priority)}`}>
                          {issue.priority || 'Medium'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatDate(issue.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => handleViewIssueDetails(issue.id)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition-colors inline-flex items-center"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default StaffDashboard;