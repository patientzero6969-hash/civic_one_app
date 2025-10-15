import React, { useState, useEffect } from 'react';
import { useAuth } from "../../context/AuthContext";
import Header from '../common/Header';
import Sidebar from '../common/Sidebar';
import LoadingSpinner, { ErrorState } from '../common/LoadingSpinner';
import { 
  Download, 
  FileText, 
  Map, 
  TrendingUp, 
  Filter, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  BarChart3,
  PieChart,
  Calendar,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import apiService from '../../services/api';

const Analytics = () => {
  const { currentUser } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [reportsData, setReportsData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState(30);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [period, setPeriod] = useState('month');
  const [perPage, setPerPage] = useState(20);

  useEffect(() => {
    if (currentUser) {
      fetchAnalyticsData(currentPage);
    }
  }, [currentUser, dateRange, selectedDepartment, period, currentPage, perPage]);

  const fetchAnalyticsData = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      // Use the correct endpoints that exist in your backend
      const results = await Promise.allSettled([
        // Get dashboard data using the correct endpoint
        apiService.get('/api/dashboard'),
        
        // Get issues data with pagination for reports
        apiService.get('/api/issues/', {
          page: page,
          per_page: perPage,
          order_by: '-created_at',
          ...(selectedDepartment && { department: selectedDepartment })
        }),

        // Try to get trends data (with fallback)
        fetchTrendsWithFallback(),

        // Try to get department stats (with fallback)
        fetchDepartmentStatsWithFallback()
      ]);

      // Handle dashboard data
      if (results[0].status === 'fulfilled' && results[0].value) {
        setDashboardData(results[0].value);
      }

      // Handle issues/reports data
      if (results[1].status === 'fulfilled' && results[1].value) {
        const issuesResponse = results[1].value;
        setReportsData(issuesResponse.issues || issuesResponse.data || []);
        if (issuesResponse.pagination) {
          setPagination(issuesResponse.pagination);
        }
      }

    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendsWithFallback = async () => {
    try {
      // Try the trends endpoint first
      return await apiService.get('/api/dashboard/trends', { days: dateRange });
    } catch (error) {
      console.warn('Trends endpoint not available, creating fallback data');
      // Create fallback trends data from issues
      try {
        const issuesResponse = await apiService.get('/api/issues/', { 
          per_page: 100,
          order_by: '-created_at'
        });
        return createTrendsFromIssues(issuesResponse.issues || []);
      } catch (fallbackError) {
        console.warn('Could not create fallback trends data');
        return null;
      }
    }
  };

  const fetchDepartmentStatsWithFallback = async () => {
    try {
      // Try department stats endpoint
      return await apiService.get('/api/dashboard/departments');
    } catch (error) {
      console.warn('Department stats endpoint not available');
      return null;
    }
  };

  const createTrendsFromIssues = (issues) => {
    // Create simple trends data from issues array
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    const trendsData = last30Days.map(date => {
      const dayIssues = issues.filter(issue => {
        if (!issue.created_at) return false;
        return issue.created_at.split('T')[0] === date;
      });
      
      return {
        date: new Date(date).toLocaleDateString(),
        created: dayIssues.length,
        resolved: dayIssues.filter(issue => issue.status === 'resolved').length
      };
    });

    return { trends: trendsData };
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePerPageChange = (newPerPage) => {
    setPerPage(newPerPage);
    setCurrentPage(1);
  };

  const handleExportData = async (format) => {
    try {
      // Get all data for export (not paginated)
      const exportParams = {
        per_page: 1000,
        order_by: '-created_at'
      };

      if (selectedDepartment) {
        exportParams.department = selectedDepartment;
      }

      if (dateRange !== 'all') {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - dateRange);
        exportParams.created_after = cutoffDate.toISOString();
      }

      const exportResponse = await apiService.get('/api/issues/', exportParams);
      
      if (exportResponse.issues || exportResponse.data) {
        const exportData = exportResponse.issues || exportResponse.data || [];
        
        if (format === 'csv') {
          downloadCSV(exportData);
        } else if (format === 'json') {
          downloadJSON(exportData);
        }
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    }
  };

  const downloadCSV = (data) => {
    const headers = ['ID', 'Title', 'Category', 'Status', 'Priority', 'Location', 'Created Date', 'Upvotes'];
    const csvContent = [
      headers.join(','),
      ...data.map(item => [
        item.id,
        `"${item.title || ''}"`,
        item.category || '',
        item.status || '',
        item.priority || '',
        `"${item.location_description || ''}"`,
        new Date(item.created_at).toLocaleDateString(),
        item.upvotes || 0
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reports_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadJSON = (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reports_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
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

  if (loading && !reportsData.length) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => fetchAnalyticsData(currentPage)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
              <p className="mt-2 text-gray-600">Comprehensive insights and data analysis</p>
            </div>

            {/* Dashboard Stats Cards */}
            {dashboardData && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Issues</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {dashboardData.issue_stats?.total_issues || 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <div className="flex items-center">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Clock className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Pending</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {dashboardData.issue_stats?.pending_issues || 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <div className="flex items-center">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <RefreshCw className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">In Progress</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {dashboardData.issue_stats?.in_progress_issues || 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Resolved</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {dashboardData.issue_stats?.resolved_issues || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Filter Controls */}
            <div className="mb-6 bg-white p-6 rounded-lg shadow-sm">
              <div className="flex flex-wrap gap-4 items-center">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date Range
                  </label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                    <option value={365}>Last year</option>
                  </select>
                </div>

                {currentUser?.role === 'Admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department
                    </label>
                    <select
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Departments</option>
                      <option value="Public Works">Public Works</option>
                      <option value="Water Management">Water Management</option>
                      <option value="Waste Management">Waste Management</option>
                      <option value="Transportation">Transportation</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Items per page
                  </label>
                  <select
                    value={perPage}
                    onChange={(e) => handlePerPageChange(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <button
                  onClick={() => fetchAnalyticsData(currentPage)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center mt-6"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Charts and Visual Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Status Distribution Pie Chart */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <PieChart className="h-6 w-6 text-blue-500 mr-2" />
                  Status Distribution
                </h3>
                <div className="relative h-64">
                  <StatusPieChart data={dashboardData} />
                </div>
              </div>

              {/* Category Distribution Bar Chart */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <BarChart3 className="h-6 w-6 text-green-500 mr-2" />
                  Issues by Category
                </h3>
                <div className="relative h-64">
                  <CategoryBarChart data={reportsData} />
                </div>
              </div>

              {/* Trends Line Chart */}
              <div className="bg-white rounded-lg shadow-sm p-6 lg:col-span-2">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <TrendingUp className="h-6 w-6 text-purple-500 mr-2" />
                  Issues Trends (Last 30 Days)
                </h3>
                <div className="relative h-80">
                  <TrendsLineChart data={reportsData} />
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Resolution Rate</p>
                    <p className="text-2xl font-bold text-green-600">
                      {dashboardData?.issue_stats ? 
                        Math.round((dashboardData.issue_stats.resolved_issues / dashboardData.issue_stats.total_issues) * 100) || 0
                        : 0}%
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Average Response Time</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {dashboardData?.issue_stats?.avg_resolution_time ? 
                        `${Math.round(dashboardData.issue_stats.avg_resolution_time)}h`
                        : '24h'}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <Clock className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Upvotes</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {dashboardData?.issue_stats?.total_upvotes || 
                       reportsData.reduce((sum, issue) => sum + (issue.upvotes || 0), 0)}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-full">
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Reports List Section */}
            <section className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="h-6 w-6 text-blue-500 mr-2" />
                Reports Data ({pagination?.total || reportsData.length} total)
              </h3>
              
              {reportsData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Title
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
                          Created Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Upvotes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportsData.map((report) => (
                        <tr key={report.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            #{report.id}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="max-w-xs truncate" title={report.title}>
                              {report.title}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              {report.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(report.status)}`}>
                              {getStatusIcon(report.status)}
                              <span className="ml-1">{report.status}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityClass(report.priority)}`}>
                              {report.priority || 'medium'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(report.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {report.upvotes || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No reports data available</h3>
                  <p className="text-gray-500">Try adjusting your filters or check back later.</p>
                </div>
              )}

              {/* Pagination Controls */}
              {pagination && pagination.total_pages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center text-sm text-gray-700">
                    <span>
                      Showing {((pagination.page - 1) * pagination.per_page) + 1} to{' '}
                      {Math.min(pagination.page * pagination.per_page, pagination.total)} of{' '}
                      {pagination.total} results
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
            </section>

            {/* Export Section */}
            <section className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Download className="h-6 w-6 text-green-500 mr-2" />
                Export Reports
              </h3>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => handleExportData('csv')}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors inline-flex items-center"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Download CSV
                </button>
                <button
                  onClick={() => handleExportData('json')}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Download JSON
                </button>
              </div>
              
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Report includes:</strong> Issue statistics, resolution metrics, 
                  department performance, category breakdown, and trends based on your current filters.
                  Data is filtered according to your role permissions.
                </p>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

// Chart Components
const StatusPieChart = ({ data }) => {
  const getStatusData = () => {
    if (!data?.issue_stats) return [];
    
    const stats = data.issue_stats;
    return [
      { name: 'Pending', value: stats.pending_issues || 0, color: '#EF4444' },
      { name: 'In Progress', value: stats.in_progress_issues || 0, color: '#F59E0B' },
      { name: 'Resolved', value: stats.resolved_issues || 0, color: '#10B981' }
    ].filter(item => item.value > 0);
  };

  const statusData = getStatusData();
  const total = statusData.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <PieChart className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p>No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center h-full">
      <div className="relative w-48 h-48 mx-auto">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
          {statusData.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const strokeDasharray = `${percentage} ${100 - percentage}`;
            const strokeDashoffset = statusData.slice(0, index).reduce((sum, prev) => 
              sum + (prev.value / total) * 100, 0
            );
            
            return (
              <circle
                key={item.name}
                cx="50"
                cy="50"
                r="15.915"
                fill="transparent"
                stroke={item.color}
                strokeWidth="8"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={-strokeDashoffset}
                className="transition-all duration-300"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{total}</div>
            <div className="text-sm text-gray-500">Total</div>
          </div>
        </div>
      </div>
      <div className="ml-8 space-y-3">
        {statusData.map((item) => (
          <div key={item.name} className="flex items-center">
            <div 
              className="w-4 h-4 rounded-full mr-3"
              style={{ backgroundColor: item.color }}
            ></div>
            <span className="text-sm font-medium text-gray-700">{item.name}</span>
            <span className="ml-auto text-sm text-gray-500">
              {item.value} ({Math.round((item.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const CategoryBarChart = ({ data }) => {
  const getCategoryData = () => {
    if (!Array.isArray(data)) return [];
    
    const categoryCount = data.reduce((acc, issue) => {
      const category = issue.category || 'Other';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(categoryCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6); // Top 6 categories
  };

  const categoryData = getCategoryData();
  const maxValue = Math.max(...categoryData.map(item => item.value), 1);

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

  if (categoryData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p>No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex items-end space-x-4 px-4">
        {categoryData.map((item, index) => {
          const height = (item.value / maxValue) * 100;
          return (
            <div key={item.name} className="flex-1 flex flex-col items-center">
              <div className="relative w-full">
                <div 
                  className="w-full rounded-t-lg transition-all duration-500 ease-in-out"
                  style={{ 
                    height: `${Math.max(height, 5)}%`,
                    backgroundColor: colors[index % colors.length],
                    minHeight: '20px'
                  }}
                ></div>
                <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-700">
                  {item.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {categoryData.map((item, index) => (
            <div key={item.name} className="flex items-center">
              <div 
                className="w-3 h-3 rounded mr-2"
                style={{ backgroundColor: colors[index % colors.length] }}
              ></div>
              <span className="truncate" title={item.name}>
                {item.name.length > 12 ? `${item.name.substring(0, 12)}...` : item.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TrendsLineChart = ({ data }) => {
  const getTrendsData = () => {
    if (!Array.isArray(data)) return [];
    
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    return last30Days.map(date => {
      const dayIssues = data.filter(issue => {
        if (!issue.created_at) return false;
        return issue.created_at.split('T')[0] === date;
      });
      
      return {
        date: new Date(date).getDate(),
        created: dayIssues.length,
        resolved: dayIssues.filter(issue => issue.status === 'resolved').length
      };
    });
  };

  const trendsData = getTrendsData();
  const maxValue = Math.max(
    ...trendsData.map(item => Math.max(item.created, item.resolved)),
    1
  );

  if (trendsData.every(item => item.created === 0 && item.resolved === 0)) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <TrendingUp className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p>No trend data available</p>
        </div>
      </div>
    );
  }

  const createPath = (data, key) => {
    const points = data.map((item, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - (item[key] / maxValue) * 80;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  };

  return (
    <div className="h-full">
      <div className="relative h-64 mb-4">
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(y => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="#F3F4F6"
              strokeWidth="0.5"
            />
          ))}
          
          {/* Created issues line */}
          <path
            d={createPath(trendsData, 'created')}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2"
            className="drop-shadow-sm"
          />
          
          {/* Resolved issues line */}
          <path
            d={createPath(trendsData, 'resolved')}
            fill="none"
            stroke="#10B981"
            strokeWidth="2"
            className="drop-shadow-sm"
          />
          
          {/* Data points */}
          {trendsData.map((item, index) => {
            const x = (index / (trendsData.length - 1)) * 100;
            const createdY = 100 - (item.created / maxValue) * 80;
            const resolvedY = 100 - (item.resolved / maxValue) * 80;
            
            return (
              <g key={index}>
                <circle cx={x} cy={createdY} r="1" fill="#3B82F6" />
                <circle cx={x} cy={resolvedY} r="1" fill="#10B981" />
              </g>
            );
          })}
        </svg>
        
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 -ml-8">
          <span>{maxValue}</span>
          <span>{Math.round(maxValue * 0.75)}</span>
          <span>{Math.round(maxValue * 0.5)}</span>
          <span>{Math.round(maxValue * 0.25)}</span>
          <span>0</span>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex justify-center space-x-6">
        <div className="flex items-center">
          <div className="w-4 h-0.5 bg-blue-500 mr-2"></div>
          <span className="text-sm text-gray-600">Issues Created</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-0.5 bg-green-500 mr-2"></div>
          <span className="text-sm text-gray-600">Issues Resolved</span>
        </div>
      </div>
      
      {/* X-axis labels */}
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>30 days ago</span>
        <span>15 days ago</span>
        <span>Today</span>
      </div>
    </div>
  );
};

export default Analytics;