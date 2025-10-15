import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer
} from 'recharts';

const Charts = ({ dashboardData }) => {
  // Color schemes for different chart types
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16'];
  const BAR_COLOR = '#3B82F6';
  const LINE_COLOR = '#10B981';

  // Prepare data for department performance chart
  const departmentChartData = dashboardData?.issue_stats?.issues_by_department 
    ? Object.entries(dashboardData.issue_stats.issues_by_department).map(([dept, count]) => ({
        department: dept.length > 15 ? dept.substring(0, 15) + '...' : dept,
        issues: count
      }))
    : [];

  // Prepare data for category breakdown pie chart
  const categoryChartData = dashboardData?.issue_stats?.issues_by_category 
    ? Object.entries(dashboardData.issue_stats.issues_by_category).map(([category, count]) => ({
        name: category.charAt(0).toUpperCase() + category.slice(1),
        value: count
      })).filter(item => item.value > 0)
    : [];

  // Prepare data for status breakdown
  const statusChartData = dashboardData?.issue_stats ? [
    { name: 'Pending', value: dashboardData.issue_stats.pending_issues, color: '#F59E0B' },
    { name: 'In Progress', value: dashboardData.issue_stats.in_progress_issues, color: '#3B82F6' },
    { name: 'Resolved', value: dashboardData.issue_stats.resolved_issues, color: '#10B981' }
  ].filter(item => item.value > 0) : [];

  // Prepare assignment data
  const assignmentChartData = dashboardData?.system_stats ? [
    { name: 'Active', value: dashboardData.system_stats.active_assignments, color: '#3B82F6' },
    { name: 'Completed', value: dashboardData.system_stats.completed_assignments, color: '#10B981' }
  ].filter(item => item.value > 0) : [];

  // Custom tooltip for better data display
  const CustomTooltip = ({ active, payload, label, prefix = '', suffix = '' }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.name || entry.dataKey}: ${prefix}${entry.value}${suffix}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!dashboardData) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-white p-4 rounded-lg border border-gray-200 animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Department Performance Chart */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">
          Issues by Department
        </h4>
        {departmentChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={departmentChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="department" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                content={<CustomTooltip suffix=" issues" />}
                cursor={{ fill: 'rgba(16, 185, 129, 0.1)' }}
              />
              <Bar 
                dataKey="issues" 
                fill="#10B981"
                radius={[4, 4, 0, 0]}
                name="Issues"
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            No department data available
          </div>
        )}
      </div>

      {/* Category Breakdown Pie Chart */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">
          Issues by Category
        </h4>
        {categoryChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                        <p className="font-medium text-gray-900">{data.name}</p>
                        <p className="text-sm text-gray-600">{data.value} issues</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            No category data available
          </div>
        )}
      </div>

      {/* Issue Status Chart */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">
          Issue Status Distribution
        </h4>
        {statusChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                        <p className="font-medium text-gray-900">{data.name}</p>
                        <p className="text-sm text-gray-600">{data.value} issues</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            No status data available
          </div>
        )}
      </div>

      {/* Assignment Status Chart */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">
          Assignment Status
        </h4>
        {assignmentChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={assignmentChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                content={<CustomTooltip suffix=" assignments" />}
                cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
              />
              <Bar 
                dataKey="value" 
                fill={BAR_COLOR}
                radius={[4, 4, 0, 0]}
                name="Assignments"
              >
                {assignmentChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            No assignment data available
          </div>
        )}
      </div>

      {/* Summary Statistics */}
      <div className="lg:col-span-2 bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">
          Summary Statistics
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {dashboardData?.issue_stats?.total_issues || 0}
            </div>
            <div className="text-sm text-gray-600">Total Issues</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {dashboardData?.issue_stats?.resolved_issues || 0}
            </div>
            <div className="text-sm text-gray-600">Resolved Issues</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">
              {dashboardData?.system_stats?.total_assignments || 0}
            </div>
            <div className="text-sm text-gray-600">Total Assignments</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {dashboardData?.issue_stats?.total_upvotes || 0}
            </div>
            <div className="text-sm text-gray-600">Total Upvotes</div>
          </div>
        </div>

        {/* Additional metrics if available */}
        {dashboardData?.issue_stats?.avg_resolution_time && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-xl font-bold text-gray-700">
                {dashboardData.issue_stats.avg_resolution_time} days
              </div>
              <div className="text-sm text-gray-600">Average Resolution Time</div>
            </div>
          </div>
        )}

        {/* User statistics for admins/supervisors */}
        {dashboardData?.user_stats && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-indigo-50 rounded-lg">
              <div className="text-lg font-bold text-indigo-600">
                {dashboardData.user_stats.total_users}
              </div>
              <div className="text-xs text-gray-600">Total Users</div>
            </div>
            <div className="text-center p-3 bg-cyan-50 rounded-lg">
              <div className="text-lg font-bold text-cyan-600">
                {dashboardData.user_stats.staff}
              </div>
              <div className="text-xs text-gray-600">Staff Members</div>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <div className="text-lg font-bold text-emerald-600">
                {dashboardData.user_stats.citizens}
              </div>
              <div className="text-xs text-gray-600">Citizens</div>
            </div>
            <div className="text-center p-3 bg-rose-50 rounded-lg">
              <div className="text-lg font-bold text-rose-600">
                {dashboardData.user_stats.supervisors}
              </div>
              <div className="text-xs text-gray-600">Supervisors</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Charts;