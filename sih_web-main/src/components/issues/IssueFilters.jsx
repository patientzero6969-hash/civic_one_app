import React from 'react';
import { Search, Filter, X } from 'lucide-react';

const IssueFilters = ({ filters, onFiltersChange, currentUser }) => {
  const handleFilterChange = (key, value) => {
    onFiltersChange(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearAllFilters = () => {
    onFiltersChange({
      search: '',
      category: '',
      status: '',
      department: ''
    });
  };

  const hasActiveFilters = Object.values(filters).some(value => value !== '');

  // Categories based on your backend schema
  const categories = [
    'roads',
    'waste', 
    'water',
    'streetlight',
    'other'
  ];

  // Statuses based on your backend schema
  const statuses = [
    'pending',
    'in_progress', 
    'resolved'
  ];

  // Departments - these should match your backend data
  const departments = [
    'Public Works',
    'Water Management',
    'Transportation',
    'Parks & Recreation',
    'Public Safety',
    'Environmental Services',
    'Urban Planning'
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Filter className="h-5 w-5 mr-2" />
          Filters & Search
        </h3>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center"
          >
            <X className="h-4 w-4 mr-1" />
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search issues..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Category Filter */}
        <select
          value={filters.category}
          onChange={(e) => handleFilterChange('category', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        >
          <option value="">All Categories</option>
          {categories.map(category => (
            <option key={category} value={category}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        >
          <option value="">All Statuses</option>
          {statuses.map(status => (
            <option key={status} value={status}>
              {status.split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join(' ')}
            </option>
          ))}
        </select>

        {/* Department Filter - Only for Admin */}
        {currentUser?.role === 'admin' && (
          <select
            value={filters.department}
            onChange={(e) => handleFilterChange('department', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {filters.search && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Search: "{filters.search}"
                <button
                  onClick={() => handleFilterChange('search', '')}
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.category && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Category: {filters.category.charAt(0).toUpperCase() + filters.category.slice(1)}
                <button
                  onClick={() => handleFilterChange('category', '')}
                  className="ml-2 text-green-600 hover:text-green-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.status && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Status: {filters.status.split('_').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}
                <button
                  onClick={() => handleFilterChange('status', '')}
                  className="ml-2 text-yellow-600 hover:text-yellow-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.department && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Department: {filters.department}
                <button
                  onClick={() => handleFilterChange('department', '')}
                  className="ml-2 text-red-600 hover:text-red-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Quick Filter Buttons */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600 mb-2">Quick filters:</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleFilterChange('status', 'pending')}
            className="px-3 py-1 text-xs font-medium bg-red-50 text-red-700 rounded-full hover:bg-red-100 transition-colors"
          >
            Pending Issues
          </button>
          <button
            onClick={() => handleFilterChange('status', 'in_progress')}
            className="px-3 py-1 text-xs font-medium bg-yellow-50 text-yellow-700 rounded-full hover:bg-yellow-100 transition-colors"
          >
            In Progress
          </button>
          <button
            onClick={() => handleFilterChange('status', 'resolved')}
            className="px-3 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-full hover:bg-green-100 transition-colors"
          >
            Resolved
          </button>
          <button
            onClick={() => handleFilterChange('category', 'roads')}
            className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors"
          >
            Roads
          </button>
          <button
            onClick={() => handleFilterChange('category', 'waste')}
            className="px-3 py-1 text-xs font-medium bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 transition-colors"
          >
            Waste
          </button>
        </div>
      </div>
    </div>
  );
};

export default IssueFilters;