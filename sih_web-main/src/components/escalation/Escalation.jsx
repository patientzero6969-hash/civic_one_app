import React, { useState, useEffect } from 'react';
import { useAuth } from "../../context/AuthContext";
import Header from '../common/Header';
import { PageLoader, ErrorState } from '../common/LoadingSpinner';
import { 
  AlertTriangle, 
  Clock, 
  ArrowUp, 
  CheckCircle, 
  User, 
  Calendar,
  MapPin,
  Building,
  Search,
  Filter,
  RefreshCw,
  Send,
  MessageSquare,
  BarChart3
} from 'lucide-react';
import apiService from '../../services/api';
import { ROLES } from '../../utils/constants';

const Escalation = () => {
  const { currentUser } = useAuth();
  const [issues, setIssues] = useState([]);
  const [escalatedIssues, setEscalatedIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [escalationReason, setEscalationReason] = useState('');
  const [showEscalationModal, setShowEscalationModal] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use correct API endpoint from your backend
      const response = await apiService.get('/api/issues?per_page=50');
      
      if (response) {
        const allIssues = response.issues || response.data || [];
        
        // Filter for issues that might need escalation
        const needsEscalation = allIssues.filter(issue => {
          const createdDate = new Date(issue.created_at);
          const daysSinceCreated = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // Logic for escalation candidates based on your backend priority system:
          // - Open for more than 7 days
          // - High priority and open for more than 3 days  
          // - Urgent priority and open for more than 1 day
          return (
            (issue.status === 'pending' && daysSinceCreated > 7) ||
            (issue.priority === 'high' && ['pending', 'in_progress'].includes(issue.status) && daysSinceCreated > 3) ||
            (issue.priority === 'urgent' && ['pending', 'in_progress'].includes(issue.status) && daysSinceCreated > 1) ||
            (issue.status === 'escalated')
          );
        });

        setIssues(needsEscalation);

        // Separate already escalated issues
        const alreadyEscalated = needsEscalation.filter(issue => issue.status === 'escalated');
        setEscalatedIssues(alreadyEscalated);
      } else {
        throw new Error('Failed to fetch issues');
      }

    } catch (err) {
      console.error('Failed to fetch escalation data:', err);
      setError(err.message || 'Failed to load escalation data');
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async (issue) => {
    setSelectedIssue(issue);
    setShowEscalationModal(true);
  };

  const submitEscalation = async () => {
    if (!selectedIssue || !escalationReason.trim()) {
      alert('Please provide a reason for escalation');
      return;
    }

    try {
      setActionLoading(selectedIssue.id);

      // First, try to escalate using assignments endpoint if it exists
      try {
        await apiService.post(`/api/assignments/${selectedIssue.id}/escalate`, {
          reason: escalationReason
        });
      } catch (escalateErr) {
        // If escalation endpoint doesn't exist, update issue status directly
        await apiService.put(`/api/issues/${selectedIssue.id}`, {
          status: 'in_progress', // Your backend doesn't have 'escalated' status, use 'in_progress'
          priority: 'urgent' // Escalate to urgent priority
        });
      }

      // Add an update explaining the escalation
      try {
        await apiService.post('/api/updates', {
          issue_id: selectedIssue.id,
          update_text: `Issue escalated: ${escalationReason}`
        });
      } catch (updateErr) {
        console.warn('Could not add escalation update:', updateErr);
      }

      // Refresh data
      await fetchData();
      
      // Close modal and reset
      setShowEscalationModal(false);
      setEscalationReason('');
      setSelectedIssue(null);
      
      alert('Issue has been escalated successfully!');

    } catch (err) {
      console.error('Escalation failed:', err);
      alert('Failed to escalate issue: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveEscalation = async (issueId) => {
    try {
      setActionLoading(issueId);

      // Update issue status back to in_progress
      await apiService.put(`/api/issues/${issueId}`, {
        status: 'in_progress',
        priority: 'medium' // Reset priority
      });

      // Add update
      try {
        await apiService.post('/api/updates', {
          issue_id: issueId,
          update_text: 'Escalation resolved. Issue returned to normal workflow.'
        });
      } catch (updateErr) {
        console.warn('Could not add resolution update:', updateErr);
      }

      await fetchData();
      alert('Escalation resolved successfully!');

    } catch (err) {
      console.error('Failed to resolve escalation:', err);
      alert('Failed to resolve escalation: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getDaysOverdue = (createdAt) => {
    const created = new Date(createdAt);
    const now = new Date();
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryDisplayName = (category) => {
    const categoryNames = {
      'potholes': 'Potholes',
      'DamagedElectricalPoles': 'Electrical Poles',
      'Garbage': 'Garbage',
      'WaterLogging': 'Water Logging',
      'FallenTrees': 'Fallen Trees'
    };
    return categoryNames[category] || category;
  };

  // Check if user has permission to escalate
  const canEscalate = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPERVISOR;

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = issue.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         issue.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = !priorityFilter || issue.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Issue Escalation" />
        <PageLoader text="Loading escalation data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Issue Escalation" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorState
            title="Failed to load escalation data"
            message={error}
            onRetry={fetchData}
          />
        </div>
      </div>
    );
  }

  if (!canEscalate) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Issue Escalation" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
            <p className="text-gray-600">
              Only supervisors and administrators can access the escalation management system.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Issue Escalation" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
                Issue Escalation Management
              </h1>
              <p className="text-gray-600 mt-1">
                Monitor and manage issues that require escalation due to delays or priority
              </p>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-yellow-600 mr-2" />
                <div>
                  <p className="text-sm text-yellow-600">Needs Escalation</p>
                  <p className="text-xl font-bold text-yellow-900">
                    {filteredIssues.filter(i => i.status !== 'escalated' && i.priority !== 'urgent').length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center">
                <ArrowUp className="h-5 w-5 text-red-600 mr-2" />
                <div>
                  <p className="text-sm text-red-600">High Priority Issues</p>
                  <p className="text-xl font-bold text-red-900">
                    {filteredIssues.filter(i => i.priority === 'urgent').length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center">
                <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
                <div>
                  <p className="text-sm text-blue-600">Total Issues</p>
                  <p className="text-xl font-bold text-blue-900">{filteredIssues.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Issues
              </label>
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by title or description..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Priority
              </label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Issues List */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Issues Requiring Attention ({filteredIssues.length})
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            {filteredIssues.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">No issues require escalation</p>
                <p className="text-sm text-gray-500 mt-2">
                  All issues are being handled within expected timeframes
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Issue Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days Overdue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredIssues.map((issue) => (
                    <tr key={issue.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {issue.title || `Issue #${issue.id}`}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {issue.description?.substring(0, 100)}
                            {issue.description?.length > 100 && '...'}
                          </div>
                          <div className="flex items-center text-xs text-gray-400 mt-1">
                            <Calendar className="h-3 w-3 mr-1" />
                            Created {new Date(issue.created_at).toLocaleDateString()}
                          </div>
                          {issue.citizen_name && (
                            <div className="flex items-center text-xs text-gray-400 mt-1">
                              <User className="h-3 w-3 mr-1" />
                              {issue.citizen_name}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getPriorityColor(issue.priority)}`}>
                          {issue.priority || 'medium'}
                        </span>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(issue.status)}`}>
                          {issue.status}
                        </span>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 text-red-500 mr-1" />
                          <span className={`text-sm font-medium ${
                            getDaysOverdue(issue.created_at) > 7 ? 'text-red-600' : 'text-yellow-600'
                          }`}>
                            {getDaysOverdue(issue.created_at)} days
                          </span>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <Building className="h-4 w-4 mr-1" />
                          {getCategoryDisplayName(issue.category)}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-2">
                          {issue.priority === 'urgent' ? (
                            <button
                              onClick={() => handleResolveEscalation(issue.id)}
                              disabled={actionLoading === issue.id}
                              className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {actionLoading === issue.id ? 'Resolving...' : 'De-escalate'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleEscalate(issue)}
                              disabled={actionLoading === issue.id}
                              className="inline-flex items-center px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                              <ArrowUp className="h-3 w-3 mr-1" />
                              {actionLoading === issue.id ? 'Escalating...' : 'Escalate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Escalation Modal */}
      {showEscalationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Escalate Issue
            </h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Issue:</strong> {selectedIssue?.title}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Days overdue:</strong> {selectedIssue && getDaysOverdue(selectedIssue.created_at)}
              </p>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Escalation
              </label>
              <textarea
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
                placeholder="Explain why this issue needs to be escalated..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={submitEscalation}
                disabled={actionLoading || !escalationReason.trim()}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Escalating...' : 'Escalate Issue'}
              </button>
              <button
                onClick={() => {
                  setShowEscalationModal(false);
                  setEscalationReason('');
                  setSelectedIssue(null);
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Escalation;