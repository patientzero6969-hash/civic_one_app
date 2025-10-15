import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../common/Sidebar';
import Header from '../common/Header';
import LoadingSpinner from '../common/LoadingSpinner';
import { 
  Search, 
  Filter, 
  MapPin, 
  Calendar, 
  Eye, 
  ThumbsUp,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Download
} from 'lucide-react';
import apiService from '../../services/api';

const ISSUE_CATEGORIES = {
  roads: 'Roads & Infrastructure',
  waste: 'Waste Management', 
  water: 'Water Supply',
  streetlight: 'Street Lighting',
  other: 'Other'
};

const ISSUE_STATUSES = {
  pending: { label: 'Pending', icon: AlertCircle, color: 'text-red-600' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'text-yellow-600' },
  resolved: { label: 'Resolved', icon: CheckCircle, color: 'text-green-600' }
};

const IssueSearch = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    status: '',
    priority: '',
    department: '',
    date_from: '',
    date_to: '',
    min_upvotes: '',
    has_location: ''
  });
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (page = 1) => {
    if (!searchQuery.trim() && !Object.values(filters).some(val => val)) {
      setError('Please enter search terms or select filters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchParams = {
        query: searchQuery.trim(),
        ...filters,
        page,
        per_page: 20
      };

      // Clean empty parameters
      Object.keys(searchParams).forEach(key => {
        if (searchParams[key] === '') delete searchParams[key];
      });

      const response = await apiService.searchIssues(searchParams);
      
      if (response.success) {
        setIssues(response.issues || []);
        setPagination(response.pagination);
        setHasSearched(true);
      } else {
        setError('Search failed');
      }
    } catch (err) {
      console.error('Search failed:', err);
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilters({
      category: '',
      status: '',
      priority: '',
      department: '',
      date_from: '',
      date_to: '',
      min_upvotes: '',
      has_location: ''
    });
    setIssues([]);
    setHasSearched(false);
    setPagination(null);
    setCurrentPage(1);
  };

  const handleExport = () => {
    if (issues.length === 0) return;

    const csvContent = [
      ['ID', 'Title', 'Category', 'Status', 'Priority', 'Upvotes', 'Created Date', 'Location'],
      ...issues.map(issue => [
        issue.id,
        issue.title,
        ISSUE_CATEGORIES[issue.category] || issue.category,
        ISSUE_STATUSES[issue.status]?.label || issue.status,
        issue.priority,
        issue.upvotes,
        new Date(issue.created_at).toLocaleDateString(),
        issue.location_description || `${issue.latitude}, ${issue.longitude}` || 'No location'
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `issue_search_results_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-60">
        <Header title="Advanced Issue Search" />
        
        <main className="p-6">
          {/* Search Form */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Search className="h-6 w-6 text-blue-600 mr-3" />
              Search Issues
            </h2>

            {/* Main Search Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Terms
              </label>
              <div className="relative">
                <Search className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in titles and descriptions..."
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch(1)}
                />
              </div>
            </div>

            {/* Advanced Filters */}
            <div className="border-t pt-6">
              <div className="flex items-center mb-4">
                <Filter className="h-5 w-5 text-gray-500 mr-2" />
                <span className="text-lg font-medium text-gray-900">Advanced Filters</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Categories</option>
                    {Object.entries(ISSUE_CATEGORIES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Statuses</option>
                    {Object.entries(ISSUE_STATUSES).map(([key, status]) => (
                      <option key={key} value={key}>{status.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={filters.priority}
                    onChange={(e) => handleFilterChange('priority', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <input
                    type="text"
                    value={filters.department}
                    onChange={(e) => handleFilterChange('department', e.target.value)}
                    placeholder="Department name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => handleFilterChange('date_from', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => handleFilterChange('date_to', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Upvotes
                  </label>
                  <input
                    type="number"
                    value={filters.min_upvotes}
                    onChange={(e) => handleFilterChange('min_upvotes', e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Has Location
                  </label>
                  <select
                    value={filters.has_location}
                    onChange={(e) => handleFilterChange('has_location', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Any</option>
                    <option value="true">With Location</option>
                    <option value="false">Without Location</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center mt-6 pt-6 border-t">
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear All
              </button>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => handleSearch(1)}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Search Issues
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          )}

          {/* Search Results */}
          {hasSearched && (
            <div className="bg-white rounded-lg shadow-sm">
              {/* Results Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Search Results
                    </h3>
                    {pagination && (
                      <span className="text-sm text-gray-600">
                        {pagination.total} issue{pagination.total !== 1 ? 's' : ''} found
                      </span>
                    )}
                  </div>
                  
                  {issues.length > 0 && (
                    <button
                      onClick={handleExport}
                      className="flex items-center px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </button>
                  )}
                </div>
              </div>

              {/* Results List */}
              {issues.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No issues found</h3>
                  <p className="text-gray-600">
                    Try adjusting your search terms or filters to find more results.
                  </p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-gray-200">
                    {issues.map((issue) => {
                      const StatusIcon = ISSUE_STATUSES[issue.status]?.icon || AlertCircle;
                      
                      return (
                        <div key={issue.id} className="p-6 hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h4 className="text-lg font-semibold text-gray-900">
                                  #{issue.id} - {issue.title}
                                </h4>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  issue.status === 'resolved' ? 'bg-green-100 text-green-800' :
                                  issue.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  <StatusIcon className={`h-3 w-3 mr-1 ${ISSUE_STATUSES[issue.status]?.color}`} />
                                  {ISSUE_STATUSES[issue.status]?.label || issue.status}
                                </span>
                              </div>
                              
                              <p className="text-gray-600 mb-3 line-clamp-2">
                                {issue.description}
                              </p>

                              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                <span className="inline-flex items-center">
                                  <span className="font-medium text-gray-700">
                                    {ISSUE_CATEGORIES[issue.category] || issue.category}
                                  </span>
                                  <span className="mx-2">•</span>
                                  <span className="capitalize">{issue.priority} Priority</span>
                                </span>
                                
                                {issue.location_description && (
                                  <span className="inline-flex items-center">
                                    <MapPin className="h-4 w-4 mr-1" />
                                    {issue.location_description}
                                  </span>
                                )}
                                
                                <span className="inline-flex items-center">
                                  <Calendar className="h-4 w-4 mr-1" />
                                  {formatDate(issue.created_at)}
                                </span>
                                
                                <span className="inline-flex items-center">
                                  <ThumbsUp className="h-4 w-4 mr-1" />
                                  {issue.upvotes} votes
                                </span>
                                
                                {issue.citizen_name && (
                                  <span className="text-gray-500">
                                    by {issue.citizen_name}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2 ml-4">
                              <button
                                onClick={() => navigate(`/issue-details/${issue.id}`)}
                                className="inline-flex items-center px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {pagination && pagination.total_pages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-200">
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
                            onClick={() => {
                              const newPage = Math.max(1, currentPage - 1);
                              setCurrentPage(newPage);
                              handleSearch(newPage);
                            }}
                            disabled={!pagination.has_prev || loading}
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
                                  onClick={() => {
                                    setCurrentPage(pageNum);
                                    handleSearch(pageNum);
                                  }}
                                  disabled={loading}
                                  className={`px-3 py-2 text-sm rounded-md ${
                                    pageNum === pagination.page
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-white border border-gray-300 hover:bg-gray-50'
                                  } disabled:opacity-50`}
                                >
                                  {pageNum}
                                </button>
                              );
                            })}
                          </div>
                          
                          <button
                            onClick={() => {
                              const newPage = Math.min(pagination.total_pages, currentPage + 1);
                              setCurrentPage(newPage);
                              handleSearch(newPage);
                            }}
                            disabled={!pagination.has_next || loading}
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
          )}

          {loading && (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <LoadingSpinner size="large" text="Searching issues..." />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default IssueSearch;