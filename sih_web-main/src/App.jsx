import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthProvider from './context/AuthContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import ProtectedRoute, { 
  AdminRoute, 
  StaffRoute, 
  SupervisorRoute, 
  AllRolesRoute,
  AdminOrStaffRoute 
} from './components/common/ProtectedRoute';

// Import components
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import AdminDashboard from './components/dashboards/AdminDashboard';
import StaffDashboard from './components/dashboards/StaffDashboard';
import SupervisorDashboard from './components/dashboards/SupervisorDashboard';
import IssueList from './components/issues/IssueList';
import IssueDetails from './components/issues/IssueDetails';
import Analytics from './components/analytics/Analytics';
import Escalation from './components/escalation/Escalation';
import TaskAssignment from './components/tasks/TaskAssignment';
import Settings from './components/settings/Settings';
import Profile from './components/profile/Profile';
import Chatbot from './components/chatbot/Chatbot';
// Import additional components that you'll need to create
// These are the missing components for the routes your dashboard is trying to navigate to
// You'll need to create these components in the appropriate folders:

// For now, let's create placeholder components or use existing ones
// import AssignmentsPage from './components/assignments/AssignmentsPage';
// import UpdatesPage from './components/updates/UpdatesPage';
// import CreateIssue from './components/issues/CreateIssue';

// Temporary placeholder component for missing routes
const PlaceholderPage = ({ title }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">{title}</h1>
      <p className="text-gray-600">This page is under development</p>
    </div>
  </div>
);

// Import constants
import { ROLES } from './utils/constants';

// App Routes component
const AppRoutes = () => {
  const { currentUser } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route 
        path="/login" 
        element={
          currentUser ? (
            <Navigate 
              to={
                currentUser.role === ROLES.ADMIN ? '/admin-dashboard' :
                currentUser.role === ROLES.STAFF ? '/staff-dashboard' :
                currentUser.role === ROLES.SUPERVISOR ? '/supervisor-dashboard' :
                '/login'
              } 
              replace 
            />
          ) : (
            <Login />
          )
        } 
      />
      <Route 
        path="/signup" 
        element={
          currentUser ? (
            <Navigate 
              to={
                currentUser.role === ROLES.ADMIN ? '/admin-dashboard' :
                currentUser.role === ROLES.STAFF ? '/staff-dashboard' :
                currentUser.role === ROLES.SUPERVISOR ? '/supervisor-dashboard' :
                '/login'
              } 
              replace 
            />
          ) : (
            <Signup />
          )
        } 
      />

      {/* Protected dashboard routes */}
      <Route 
        path="/admin-dashboard" 
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        } 
      />
      <Route 
        path="/staff-dashboard" 
        element={
          <StaffRoute>
            <StaffDashboard />
          </StaffRoute>
        } 
      />
      <Route 
        path="/supervisor-dashboard" 
        element={
          <SupervisorRoute>
            <SupervisorDashboard />
          </SupervisorRoute>
        } 
      />

      {/* Issue management routes */}
      <Route 
        path="/issues" 
        element={
          <AllRolesRoute>
            <IssueList />
          </AllRolesRoute>
        } 
      />
      <Route 
        path="/issues/:id" 
        element={
          <AllRolesRoute>
            <IssueDetails />
          </AllRolesRoute>
        } 
      />
      <Route 
        path="/issue-details/:id" 
        element={
          <AllRolesRoute>
            <IssueDetails />
          </AllRolesRoute>
        } 
      />
      <Route 
        path="/create-issue" 
        element={
          <AllRolesRoute>
            <PlaceholderPage title="Create Issue" />
          </AllRolesRoute>
        } 
      />

      {/* Assignment management routes - THESE WERE MISSING */}
      <Route 
        path="/assignments" 
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.STAFF]}>
            <PlaceholderPage title="My Assignments" />
          </ProtectedRoute>
        } 
      />
      <Route path="/task-assignment" element={<TaskAssignment />} />
      <Route 
        path="/manage-assignments" 
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <TaskAssignment />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/assign-task" 
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <TaskAssignment />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/bulk-assignment" 
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <TaskAssignment />
          </ProtectedRoute>
        } 
      />

      {/* Updates management routes - THESE WERE MISSING */}
      <Route path="/updates" element={<Navigate to="/issues" replace />} />

      <Route 
        path="/issue-updates" 
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.STAFF]}>
            <PlaceholderPage title="Issue Updates" />
          </ProtectedRoute>
        } 
      />

      {/* Analytics and reporting routes */}
      <Route 
        path="/analytics" 
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.STAFF, ROLES.SUPERVISOR]}>
            <Analytics />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/reports" 
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <Analytics />
          </ProtectedRoute>
        } 
      />

      {/* Escalation routes */}
      <Route 
        path="/escalation" 
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <Escalation />
          </ProtectedRoute>
        } 
      />

      {/* User management routes */}
      <Route 
        path="/users" 
        element={
          <AdminRoute>
            <PlaceholderPage title="User Management" />
          </AdminRoute>
        } 
      />
      <Route 
        path="/staff" 
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
            <PlaceholderPage title="Staff Management" />
          </ProtectedRoute>
        } 
      />

      {/* Settings and configuration routes */}
      <Route 
        path="/settings" 
        element={
          <AdminRoute>
            <Settings />
          </AdminRoute>
        } 
      />
      <Route 
        path="/profile" 
        element={
          <AllRolesRoute>
            <Profile />
          </AllRolesRoute>
        } 
      />

      {/* Department specific routes */}
      <Route 
        path="/department" 
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.STAFF]}>
            <PlaceholderPage title="Department Dashboard" />
          </ProtectedRoute>
        } 
      />

      {/* Default redirect based on user role */}
      <Route 
        path="/dashboard" 
        element={
          currentUser ? (
            <Navigate 
              to={
                currentUser.role === ROLES.ADMIN ? '/admin-dashboard' :
                currentUser.role === ROLES.STAFF ? '/staff-dashboard' :
                currentUser.role === ROLES.SUPERVISOR ? '/supervisor-dashboard' :
                '/login'
              } 
              replace 
            />
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />
      <Route path="/chatbot" element={<Chatbot />} />
      <Route 
        path="/" 
        element={
          currentUser ? (
            <Navigate 
              to={
                currentUser.role === ROLES.ADMIN ? '/admin-dashboard' :
                currentUser.role === ROLES.STAFF ? '/staff-dashboard' :
                currentUser.role === ROLES.SUPERVISOR ? '/supervisor-dashboard' :
                '/login'
              } 
              replace 
            />
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />

      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// Main App component
const App = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="App">
            <AppRoutes />
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;