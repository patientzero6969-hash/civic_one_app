import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft, Home, Wifi, WifiOff } from 'lucide-react';

// Basic Loading Spinner Component
const LoadingSpinner = ({ 
  size = 'medium', 
  text = 'Loading...', 
  subText = '',
  className = '' 
}) => {
  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-8 w-8',
    large: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  const containerClasses = {
    small: 'p-2',
    medium: 'p-4',
    large: 'p-8',
    xl: 'p-12'
  };

  return (
    <div className={`flex items-center justify-center ${containerClasses[size]} ${className}`}>
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className={`animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 ${sizeClasses[size]}`} />
        </div>
        {text && (
          <p className="text-gray-600 font-medium">{text}</p>
        )}
        {subText && (
          <p className="text-gray-500 text-sm mt-1">{subText}</p>
        )}
      </div>
    </div>
  );
};

// Page-level loading component
export const PageLoader = ({ 
  text = 'Loading page...', 
  subText = '', 
  showLogo = true 
}) => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        {showLogo && (
          <div className="mb-8">
            <div className="h-16 w-16 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl font-bold">CC</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Civic Connect</h1>
          </div>
        )}
        
        <div className="flex justify-center mb-6">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600" />
        </div>
        
        <p className="text-lg text-gray-600 font-medium mb-2">{text}</p>
        {subText && (
          <p className="text-gray-500">{subText}</p>
        )}
      </div>
    </div>
  );
};

// Error State Component
export const ErrorState = ({ 
  title = 'Something went wrong',
  message = 'An unexpected error occurred',
  onRetry,
  onGoBack,
  onGoHome,
  showIcon = true,
  type = 'error' // error, network, permission, notfound
}) => {
  const getIcon = () => {
    switch (type) {
      case 'network':
        return <WifiOff className="h-12 w-12 text-red-500" />;
      case 'permission':
        return <AlertTriangle className="h-12 w-12 text-yellow-500" />;
      case 'notfound':
        return <AlertTriangle className="h-12 w-12 text-gray-500" />;
      default:
        return <AlertTriangle className="h-12 w-12 text-red-500" />;
    }
  };

  const getColorClasses = () => {
    switch (type) {
      case 'network':
        return 'text-red-600';
      case 'permission':
        return 'text-yellow-600';
      case 'notfound':
        return 'text-gray-600';
      default:
        return 'text-red-600';
    }
  };

  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        {showIcon && (
          <div className="flex justify-center mb-4">
            {getIcon()}
          </div>
        )}
        
        <h3 className={`text-lg font-medium mb-2 ${getColorClasses()}`}>
          {title}
        </h3>
        
        <p className="text-gray-600 mb-6">
          {message}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </button>
          )}
          
          {onGoBack && (
            <button
              onClick={onGoBack}
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </button>
          )}
          
          {onGoHome && (
            <button
              onClick={onGoHome}
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Home className="h-4 w-4 mr-2" />
              Home
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Network Status Component
export const NetworkStatus = ({ isOnline = true }) => {
  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white px-4 py-2 text-center text-sm z-50">
      <div className="flex items-center justify-center">
        <WifiOff className="h-4 w-4 mr-2" />
        No internet connection. Some features may not work properly.
      </div>
    </div>
  );
};

// Skeleton Loader Components
export const SkeletonCard = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
);

export const SkeletonText = ({ lines = 1, className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className={`animate-pulse bg-gray-200 rounded ${
          i === lines - 1 ? 'w-3/4' : 'w-full'
        } h-4`}
      />
    ))}
  </div>
);

export const SkeletonTable = ({ rows = 5, columns = 4 }) => (
  <div className="animate-pulse">
    {/* Table Header */}
    <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-300 rounded" />
      ))}
    </div>
    
    {/* Table Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="grid gap-4 mb-3" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <div key={colIndex} className="h-4 bg-gray-200 rounded" />
        ))}
      </div>
    ))}
  </div>
);

// Full Page Skeleton
export const PageSkeleton = () => (
  <div className="min-h-screen bg-gray-50 animate-pulse">
    {/* Header Skeleton */}
    <div className="bg-white shadow-sm p-4">
      <div className="flex justify-between items-center">
        <div className="h-6 bg-gray-200 rounded w-48" />
        <div className="flex space-x-3">
          <div className="h-8 bg-gray-200 rounded w-24" />
          <div className="h-8 bg-gray-200 rounded w-32" />
        </div>
      </div>
    </div>
    
    {/* Content Skeleton */}
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="h-24" />
        ))}
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-64" />
      </div>
      
      {/* Table */}
      <div className="bg-white rounded-lg p-6">
        <SkeletonTable />
      </div>
    </div>
  </div>
);

// Inline Loading Component (for buttons, etc.)
export const InlineLoader = ({ size = 'small' }) => {
  const sizeClasses = {
    small: 'h-3 w-3',
    medium: 'h-4 w-4',
    large: 'h-5 w-5'
  };

  return (
    <div className={`animate-spin rounded-full border-2 border-current border-t-transparent ${sizeClasses[size]}`} />
  );
};

// Connection Status Component
export const ConnectionStatus = ({ 
  isConnected = true, 
  isLoading = false,
  lastUpdated = null 
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center text-sm text-gray-500">
        <InlineLoader size="small" />
        <span className="ml-2">Connecting...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center text-sm">
      <div className={`h-2 w-2 rounded-full mr-2 ${
        isConnected ? 'bg-green-500' : 'bg-red-500'
      }`} />
      <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
        {isConnected ? 'Connected' : 'Disconnected'}
      </span>
      {lastUpdated && isConnected && (
        <span className="text-gray-500 ml-2">
          • Last updated {new Date(lastUpdated).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};

export default LoadingSpinner;