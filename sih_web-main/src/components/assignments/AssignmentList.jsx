import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../common/Sidebar';
import Header from '../common/Header';
import LoadingSpinner from '../common/LoadingSpinner';
import { 
  Briefcase, 
  User, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Eye,
  Edit3,
  Trash2,
  Filter,
  Search,
  RefreshCw,
  Plus,
  MapPin,
  FileText
} from 'lucide-react';
import apiService from '../../services/api';

const ASSIGNMENT_STATUSES = {
  assigned: { label: 'Assigned', color: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' }
};

const AssignmentList = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    department: '',
    staff_id: ''
  });
  const [refreshing, setRefreshing] = useState(false);

  const fetchAssignments = async (page = 1) => {
    try {
      setLoading(page === 1);
      setError(null);

      const params = {
        page,
        per_page: 20,
        ...filters
      };

      // Clean empty parameters
      Object.keys(params).forEach(key => {
        if (params[key] === '') delete params[key];
      });

      const response = await apiService.getAssignments(params);
      
      if (response.success) {
        setAssignments(response.assignments || []);
        setPagination(response.pagination);
      } else {
        setError('Failed to fetch assignments');
      }
    } catch (err) {
      console.error('Failed to fetch assignments:', err);
      setError(err.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchAssignments(currentPage);
    }
  }, [currentUser, currentPage, filters]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setCurrentPage(1);
    await fetchAssignments(1);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleStatusUpdate = async (assignmentId, newStatus) => {
    try {
      const response = await apiService.updateAssignment(assignmentId, { status: newStatus });
      
      if (response.success) {
        // Update local state
        setAssignments(prev => 
          prev.map(assignment => 
            assignment.id === assignmentId 
              ? { ...assignment, status: newStatus }
              : assignment
          )
        );
      } else {
        alert('Failed to update assignment status');
      }
    } catch (error) {
      console.error('Failed to update assignment status:', error);
      alert('Failed to update assignment status: ' + error.message);
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!confirm('Are you sure you want to delete this assignment?')) {
      return;
    }

    try {
      await apiService.deleteAssignment(assignmentId);
      
      // Remove from local state
      setAssignments(prev => prev.filter(assignment => assignment.id !== assignmentId));
      
      // Refresh if current page becomes empty
      if (assignments.length === 1 && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }
    } catch (error) {
      console.error('Failed to delete assignment:', error);
      alert('Failed to delete assignment: ' + error.message);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canManageAssignments = () => {
    return currentUser?.role === 'admin' || currentUser?.role === 'supervisor';
  };

  const canEditAssignment = (assignment) => {
    if (currentUser?.role === 'admin') return true;
    if (currentUser?.role === 'supervisor') {
      // Supervisor can edit assignments in their department
      return assignment.department === currentUser.department;
    }
    if (currentUser?.role === 'staff') {
      // Staff can only update status of their own assignments
      return assignment.staff_id === currentUser.id;
    }
    return false;
  };

  if (loading && assignments.length === 0) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 ml-60">
          <Header title="Assignments" />
          <main className="p-6">
            <LoadingSpinner size="large" text="Loading assignments..." />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-60">
        <Header title="Assignment Management" />
        
        <main className="p-6">
          {/* Header Actions */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <Briefcase className="h-8 w-8 text-blue-600 mr-3" />
                All Assignments
              </h2>
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">
                {pagination?.total || 0} total
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {canManageAssignments() && (
                <button
                  onClick={() => navigate('/assignments/create')}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Assignment
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center mb-4">
              <Filter className="h-5 w-5 text-gray-500 mr-2" />
              <span className="text-lg font-medium text-gray-900">Filters</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search
                </label>
                <div className="relative">
                  <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search assignments..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Statuses</option>
                  {Object.entries(ASSIGNMENT_STATUSES).map(([key, status]) => (
                    <option key={key} value={key}>{status.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department
                </label>
                <input
                  type="text"
                  placeholder="Filter by department..."
                  value={filters.department}
                  onChange={(e) => handleFilterChange('department', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Staff ID
                </label>
                <input
                  type="text"
                  placeholder="Filter by staff ID..."
                  value={filters.staff_id}
                  onChange={(e) => handleFilterChange('staff_id', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          )}

          {/* Assignments Table */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {assignments.length === 0 ? (
              <div className="text-center py-12">
                <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments found</h3>
                <p className="text-gray-600 mb-4">
                  {filters.search || filters.status || filters.department || filters.staff_id
                    ? "No assignments match your current filters."
                    : "No assignments have been created yet."
                  }
                </p>
                {canManageAssignments() && (
                  <button
                    onClick={() => navigate('/assignments/create')}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Assignment
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Issue Details
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Assigned To
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Dates
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {assignments.map((assignment) => (
                        <tr key={assignment.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-start space-x-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  #{assignment.issue_id} - {assignment.issue_title || 'Issue Title'}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {assignment.issue_category || 'Category'} • {assignment.priority || 'Medium'} Priority
                                </p>
                                {assignment.location && (
                                  <p className="text-xs text-gray-500 flex items-center mt-1">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    {assignment.location}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                                  <User className="h-4 w-4 text-gray-600" />
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {assignment.staff_name || `Staff ${assignment.staff_id}`}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {assignment.department || 'No Department'}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-col space-y-2">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                ASSIGNMENT_STATUSES[assignment.status]?.color || 'bg-gray-100 text-gray-800'
                              }`}>
                                {ASSIGNMENT_STATUSES[assignment.status]?.label || assignment.status}
                              </span>
                              {canEditAssignment(assignment) && assignment.status !== 'completed' && (
                                <select
                                  value={assignment.status}
                                  onChange={(e) => handleStatusUpdate(assignment.id, e.target.value)}
                                  className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                                >
                                  {Object.entries(ASSIGNMENT_STATUSES).map(([key, status]) => (
                                    <option key={key} value={key}>{status.label}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              <div className="flex items-center space-x-1 mb-1">
                                <Calendar className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-600">Assigned:</span>
                                <span className="text-xs">{formatDate(assignment.created_at)}</span>
                              </div>
                              {assignment.updated_at !== assignment.created_at && (
                                <div className="flex items-center space-x-1">
                                  <Clock className="h-3 w-3 text-gray-400" />
                                  <span className="text-xs text-gray-600">Updated:</span>
                                  <span className="text-xs">{formatDate(assignment.updated_at)}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => navigate(`/issue-details/${assignment.issue_id}`)}
                                className="text-blue-600 hover:text-blue-800 transition-colors"
                                title="View Issue"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              
                              {canEditAssignment(assignment) && (
                                <>
                                  <button
                                    onClick={() => navigate(`/assignments/edit/${assignment.id}`)}
                                    className="text-green-600 hover:text-green-800 transition-colors"
                                    title="Edit Assignment"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </button>
                                  
                                  {canManageAssignments() && (
                                    <button
                                      onClick={() => handleDeleteAssignment(assignment.id)}
                                      className="text-red-600 hover:text-red-800 transition-colors"
                                      title="Delete Assignment"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pagination && pagination.total_pages > 1 && (
                  <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <p className="text-sm text-gray-700">
                          Showing{' '}
                          <span className="font-medium">
                            {((pagination.page - 1) * pagination.per_page) + 1}
                          </span>{' '}
                          to{' '}
                          <span className="font-medium">
                            {Math.min(pagination.page * pagination.per_page, pagination.total)}
                          </span>{' '}
                          of{' '}
                          <span className="font-medium">{pagination.total}</span>{' '}
                          results
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={!pagination.has_prev}
                          className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
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
                                onClick={() => setCurrentPage(pageNum)}
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
                          onClick={() => setCurrentPage(prev => Math.min(pagination.total_pages, prev + 1))}
                          disabled={!pagination.has_next}
                          className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AssignmentList;