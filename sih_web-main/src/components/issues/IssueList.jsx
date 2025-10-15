import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";
import { useIssues } from '../../hooks/useIssues';
import Header from '../common/Header';
import Sidebar from '../common/Sidebar';
import LoadingSpinner, { ErrorState } from '../common/LoadingSpinner';
import { 
  Eye, 
  UserPlus, 
  RefreshCw, 
  CheckSquare, 
  Square, 
  ThumbsUp, 
  Filter,
  Search,
  Plus,
  Download,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  User,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';

const IssueList = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { issues, loading, fetchIssues, voteIssue, removeVote } = useIssues();
  
  const [selectedIssues, setSelectedIssues] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    status: '',
    department: '',
    priority: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Fetch issues when page, filters, or perPage changes
  useEffect(() => {
    loadIssues(currentPage);
  }, [currentUser, filters, currentPage, perPage]);

  const loadIssues = async (page = 1) => {
    if (!currentUser) return;

    try {
      const params = {
        ...filters,
        page: page,
        per_page: perPage,
        order_by: '-created_at'
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '') delete params[key];
      });

      const data = await fetchIssues(params);
      if (data?.pagination) {
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to load issues:', error);
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePerPageChange = (newPerPage) => {
    setPerPage(newPerPage);
    setCurrentPage(1); // Reset to first page when changing per page
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleSearch = (searchTerm) => {
    setFilters(prev => ({ ...prev, search: searchTerm }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      category: '',
      status: '',
      department: '',
      priority: ''
    });
    setCurrentPage(1);
  };

  const handleViewIssue = (issueId) => {
    navigate(`/issue-details/${issueId}`);
  };

  const handleAssignIssue = async (issueId) => {
    if (!canAssignIssues()) {
      alert('You are not allowed to assign issues.');
      return;
    }

    const staffId = prompt('Enter Staff ID or Email to assign:');
    if (staffId && staffId.trim()) {
      try {
        const response = await fetch('/api/assignments/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser.token}`,
          },
          body: JSON.stringify({
            issue_id: parseInt(issueId),
            staff_id: staffId.trim(),
            notes: 'Assigned via issue list'
          }),
        });

        if (response.ok) {
          alert('Issue assigned successfully');
          loadIssues(currentPage);
        } else {
          const error = await response.json();
          alert(`Failed to assign issue: ${error.detail}`);
        }
      } catch (error) {
        alert('Failed to assign issue: ' + error.message);
      }
    }
  };

  const handleChangeStatus = async (issueId, currentStatus) => {
    const statusOptions = ['pending', 'in_progress', 'resolved'];
    const newStatus = prompt(
      `Current status: ${currentStatus}\nEnter new status (pending/in_progress/resolved):`
    );
    
    if (newStatus && statusOptions.includes(newStatus)) {
      try {
        const response = await fetch(`/api/issues/${issueId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser.token}`,
          },
          body: JSON.stringify({
            status: newStatus
          }),
        });

        if (response.ok) {
          alert('Status updated successfully');
          loadIssues(currentPage);
        } else {
          const error = await response.json();
          alert(`Failed to update status: ${error.detail}`);
        }
      } catch (error) {
        alert('Failed to update status: ' + error.message);
      }
    }
  };

  const handleVote = async (issueId, hasVoted) => {
    try {
      if (hasVoted) {
        await removeVote(issueId);
      } else {
        await voteIssue(issueId);
      }
      // Refresh current page to show updated vote counts
      loadIssues(currentPage);
    } catch (error) {
      alert('Failed to update vote: ' + error.message);
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIssues(issues.map(i => i.id));
    } else {
      setSelectedIssues([]);
    }
  };

  const handleSelectIssue = (issueId, checked) => {
    if (checked) {
      setSelectedIssues([...selectedIssues, issueId]);
    } else {
      setSelectedIssues(selectedIssues.filter(id => id !== issueId));
    }
  };

  const handleBulkAssign = async () => {
    if (selectedIssues.length === 0) {
      alert('No issues selected.');
      return;
    }

    if (!canAssignIssues()) {
      alert('You are not allowed to bulk assign.');
      return;
    }

    const staffId = prompt('Enter Staff ID or Email for bulk assignment:');
    if (staffId && staffId.trim()) {
      try {
        const response = await fetch('/api/assignments/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser.token}`,
          },
          body: JSON.stringify({
            issue_ids: selectedIssues,
            staff_id: staffId.trim(),
            notes: 'Bulk assigned via issue list'
          }),
        });

        if (response.ok) {
          alert(`${selectedIssues.length} issues assigned successfully`);
          setSelectedIssues([]);
          loadIssues(currentPage);
        } else {
          const error = await response.json();
          alert(`Failed to bulk assign: ${error.detail}`);
        }
      } catch (error) {
        alert('Failed to bulk assign: ' + error.message);
      }
    }
  };

  // Role-based permissions
  const canAssignIssues = () => {
    return currentUser?.role === 'Admin' || currentUser?.role === 'DepartmentStaff';
  };

  const canUpdateStatus = () => {
    return currentUser?.role === 'Admin' || currentUser?.role === 'DepartmentStaff' || currentUser?.role === 'FieldSupervisor';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && !issues.length) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Issue Management</h1>
                  <p className="mt-2 text-gray-600">
                    Showing {pagination?.total || 0} total issues
                  </p>
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={() => navigate('/issues/create')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Issue
                  </button>
                  <button
                    onClick={() => loadIssues(currentPage)}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors inline-flex items-center"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="mb-6 bg-white p-6 rounded-lg shadow-sm">
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex-1 min-w-64">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search issues..."
                      value={filters.search}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 inline-flex items-center"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </button>
              </div>

              {/* Expanded Filters */}
              {showFilters && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category
                      </label>
                      <select
                        value={filters.category}
                        onChange={(e) => handleFilterChange('category', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">All Categories</option>
                        <option value="roads">Roads & Infrastructure</option>
                        <option value="waste">Waste Management</option>
                        <option value="water">Water Supply</option>
                        <option value="streetlight">Street Lighting</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        value={filters.status}
                        onChange={(e) => handleFilterChange('status', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Priority
                      </label>
                      <select
                        value={filters.priority}
                        onChange={(e) => handleFilterChange('priority', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">All Priorities</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Items per page
                      </label>
                      <select
                        value={perPage}
                        onChange={(e) => handlePerPageChange(parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 flex space-x-4">
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Issues Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {issues.length > 0 ? (
                <>
                  {/* Bulk Actions */}
                  {canAssignIssues() && (
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedIssues.length === issues.length && issues.length > 0}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Select All</span>
                        </label>
                        {selectedIssues.length > 0 && (
                          <button
                            onClick={handleBulkAssign}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
                          >
                            Assign Selected ({selectedIssues.length})
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {canAssignIssues() && (
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Select
                            </th>
                          )}
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Issue
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Priority
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Votes
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
                        {issues.map((issue) => (
                          <tr key={issue.id} className="hover:bg-gray-50">
                            {canAssignIssues() && (
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={selectedIssues.includes(issue.id)}
                                  onChange={(e) => handleSelectIssue(issue.id, e.target.checked)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                            )}
                            <td className="px-6 py-4">
                              <div className="max-w-xs">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {issue.title}
                                </div>
                                <div className="text-sm text-gray-500 truncate">
                                  {issue.description}
                                </div>
                                {issue.location_description && (
                                  <div className="text-xs text-gray-400 flex items-center mt-1">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    {issue.location_description}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                {issue.category}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(issue.status)}`}>
                                {getStatusIcon(issue.status)}
                                <span className="ml-1">{issue.status}</span>
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityClass(issue.priority)}`}>
                                {issue.priority || 'Medium'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="flex items-center space-x-2">
                                <span>{issue.upvotes || 0}</span>
                                <button
                                  onClick={() => handleVote(issue.id, issue.user_has_voted)}
                                  className={`p-1 rounded ${
                                    issue.user_has_voted 
                                      ? 'text-blue-600 bg-blue-50' 
                                      : 'text-gray-400 hover:text-blue-600'
                                  }`}
                                >
                                  <ThumbsUp className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="flex items-center text-xs text-gray-500">
                                <Calendar className="h-3 w-3 mr-1" />
                                {formatDate(issue.created_at)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleViewIssue(issue.id)}
                                  className="bg-gray-600 text-white px-3 py-1 rounded text-xs hover:bg-gray-700 transition-colors inline-flex items-center"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </button>
                                {canAssignIssues() && (
                                  <button
                                    onClick={() => handleAssignIssue(issue.id)}
                                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition-colors inline-flex items-center"
                                  >
                                    <UserPlus className="h-3 w-3 mr-1" />
                                    Assign
                                  </button>
                                )}
                                {canUpdateStatus() && (
                                  <button
                                    onClick={() => handleChangeStatus(issue.id, issue.status)}
                                    className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors inline-flex items-center"
                                  >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Status
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No issues found</h3>
                  <p className="text-gray-500">Try adjusting your filters or create a new issue.</p>
                </div>
              )}
            </div>

            {/* Enhanced Pagination */}
            {pagination && pagination.total_pages > 1 && (
              <div className="mt-6 flex items-center justify-between bg-white px-6 py-4 rounded-lg shadow-sm">
                <div className="flex items-center text-sm text-gray-700">
                  <span>
                    Showing {((pagination.page - 1) * pagination.per_page) + 1} to{' '}
                    {Math.min(pagination.page * pagination.per_page, pagination.total)} of{' '}
                    {pagination.total} issues
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={!pagination.has_prev || loading}
                    className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </button>
                  
                  <div className="flex items-center space-x-1">
                    {[...Array(Math.min(5, pagination.total_pages))].map((_, i) => {
                      const pageNum = Math.max(1, Math.min(
                        pagination.total_pages - 4, 
                        pagination.page - 2
                      )) + i;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          disabled={loading}
                          className={`px-3 py-2 text-sm rounded-md ${
                            pageNum === pagination.page
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(Math.min(pagination.total_pages, currentPage + 1))}
                    disabled={!pagination.has_next || loading}
                    className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default IssueList;