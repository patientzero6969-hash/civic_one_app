import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";
import { PageLoader, ErrorState } from './LoadingSpinner';
import { AlertTriangle, Shield, UserX, Home, ArrowLeft } from 'lucide-react';
import { ROLES, getRoleName, getDashboardRoute } from '../../utils/constants';

const ProtectedRoute = ({ 
  children, 
  allowedRoles = [], 
  requireAuth = true,
  fallbackPath = '/login',
  showUnauthorized = true 
}) => {
  const { currentUser, isLoading, token } = useAuth();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Add a small delay to ensure auth context is fully initialized
    const checkAuth = setTimeout(() => {
      setAuthChecked(true);
    }, 100);

    return () => clearTimeout(checkAuth);
  }, [currentUser, isLoading]);

  // Show loading while authentication is being checked
  if (isLoading || !authChecked) {
    return (
      <PageLoader 
        text="Checking authentication..." 
        subText="Please wait while we verify your credentials"
      />
    );
  }

  // Handle authentication errors
  if (error) {
    return (
      <ErrorState
        title="Authentication Error"
        message={error}
        onRetry={() => {
          setError(null);
          window.location.reload();
        }}
        onGoBack={() => window.history.back()}
      />
    );
  }

  // Check if authentication is required and user is not authenticated
  if (requireAuth && (!currentUser || !token)) {
    // Store the attempted URL for redirect after login
    return (
      <Navigate 
        to={fallbackPath} 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // Check if user has required role - FIXED to use backend roles
  if (allowedRoles.length > 0 && currentUser) {
    const hasRequiredRole = allowedRoles.includes(currentUser.role);
    
    if (!hasRequiredRole) {
      if (showUnauthorized) {
        return <UnauthorizedAccess userRole={currentUser.role} requiredRoles={allowedRoles} />;
      } else {
        // Redirect to user's appropriate dashboard
        const dashboardPath = getDashboardRoute(currentUser.role);
        return <Navigate to={dashboardPath} replace />;
      }
    }
  }

  // User is authenticated and authorized
  return children;
};

// Unauthorized access component
const UnauthorizedAccess = ({ userRole, requiredRoles }) => {
  const { currentUser } = useAuth();
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h2>
            <div className="text-gray-600 space-y-2">
              <p>You don't have permission to access this page.</p>
              <div className="bg-gray-50 p-3 rounded text-sm">
                <p><strong>Your Role:</strong> {getRoleName(userRole)}</p>
                <p><strong>Required Role(s):</strong> {requiredRoles.map(role => getRoleName(role)).join(', ')}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              onClick={() => {
                const dashboardPath = getDashboardRoute(currentUser?.role);
                window.location.href = dashboardPath;
              }}
              className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Home className="h-4 w-4 mr-2" />
              Go to Dashboard
            </button>
            
            <button
              onClick={() => window.history.back()}
              className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              If you believe this is an error, please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper components for common role-based routes
export const AdminRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
    {children}
  </ProtectedRoute>
);

export const StaffRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={[ROLES.STAFF]}>
    {children}
  </ProtectedRoute>
);

export const SupervisorRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={[ROLES.SUPERVISOR]}>
    {children}
  </ProtectedRoute>
);

export const AdminOrStaffRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.STAFF]}>
    {children}
  </ProtectedRoute>
);

export const AllRolesRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.STAFF, ROLES.SUPERVISOR]}>
    {children}
  </ProtectedRoute>
);

export const AuthenticatedRoute = ({ children }) => (
  <ProtectedRoute requireAuth={true} allowedRoles={[]}>
    {children}
  </ProtectedRoute>
);

export default ProtectedRoute;