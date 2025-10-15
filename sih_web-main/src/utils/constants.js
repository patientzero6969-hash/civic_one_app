// Application constants - FIXED to match backend exactly

// ===== STANDARDIZED ROLES (Backend Format - MUST MATCH BACKEND) =====
export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff', 
  SUPERVISOR: 'supervisor',
  CITIZEN: 'citizen'
};

// Role display names for UI
export const ROLE_LABELS = {
  admin: 'Administrator',
  staff: 'Department Staff',
  supervisor: 'Field Supervisor', 
  citizen: 'Citizen'
};

// Frontend to Backend role mapping for login form
export const ROLE_MAPPING = {
  'Admin': 'admin',
  'DepartmentStaff': 'staff',
  'FieldSupervisor': 'supervisor'
};

// Helper function to get role display name
export const getRoleName = (role) => {
  return ROLE_LABELS[role] || role;
};

// Helper function to get dashboard route based on role
export const getDashboardRoute = (role) => {
  switch (role) {
    case ROLES.ADMIN:
      return '/admin-dashboard';
    case ROLES.STAFF:
      return '/staff-dashboard';
    case ROLES.SUPERVISOR:
      return '/supervisor-dashboard';
    default:
      return '/login';
  }
};

// ===== DEPARTMENT-CATEGORY MAPPING (UPDATED to match both systems) =====
export const DEPARTMENT_CATEGORIES = {
  'Road Department': ['potholes', 'roads'], // Support both formats
  'Electricity Department': ['DamagedElectricalPoles', 'streetlight'],
  'Sanitary Department': ['Garbage', 'waste'],
  'Public Service': ['WaterLogging', 'FallenTrees', 'water', 'other']
};

// Helper function to get allowed categories for a department
export const getDepartmentCategories = (department) => {
  if (!department) return [];
  return DEPARTMENT_CATEGORIES[department] || [];
};

// Helper function to check if a department can access a category
export const canDepartmentAccessCategory = (department, category) => {
  if (!department || !category) return false;
  const allowedCategories = getDepartmentCategories(department);
  return allowedCategories.includes(category);
};

// Helper function to get all available departments
export const getAvailableDepartments = () => {
  return Object.keys(DEPARTMENT_CATEGORIES);
};

// ===== NAVIGATION ROUTES =====
export const ROUTES = {
  LOGIN: '/login',
  SIGNUP: '/signup',
  ADMIN_DASHBOARD: '/admin-dashboard',
  STAFF_DASHBOARD: '/staff-dashboard',
  SUPERVISOR_DASHBOARD: '/supervisor-dashboard',
  ISSUES: '/issues',
  ISSUE_DETAILS: '/issue-details',
  ANALYTICS: '/analytics',
  ESCALATION: '/escalation',
  SETTINGS: '/settings',
  TASK_ASSIGNMENT: '/task-assignment',
  PROFILE: '/profile'
};

// ===== API ENDPOINTS (FastAPI backend) =====
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    SIGNUP: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    PROFILE: '/api/auth/me',
    VERIFY_TOKEN: '/api/auth/verify-token',
    REFRESH: '/api/auth/refresh'
  },
  ISSUES: {
    LIST: '/api/issues/',
    CREATE: '/api/issues/',
    DETAIL: '/api/issues/:id',
    UPDATE: '/api/issues/:id',
    DELETE: '/api/issues/:id',
    VOTE: '/api/issues/:id/vote',
    SEARCH: '/api/issues/search',
    STATS: '/api/issues/stats',
    NEARBY: '/api/issues/nearby',
    UPLOAD_IMAGE: '/api/issues/upload-image',
    CREATE_WITH_IMAGE: '/api/issues/create-with-image'
  },
  ASSIGNMENTS: {
    LIST: '/api/assignments/',
    CREATE: '/api/assignments/',
    DETAIL: '/api/assignments/:id',
    UPDATE: '/api/assignments/:id',
    DELETE: '/api/assignments/:id',
    BY_USER: '/api/assignments/user/:id',
    BY_ISSUE: '/api/assignments/issue/:id',
    MY_ASSIGNMENTS: '/api/assignments/my',
    BULK_ASSIGN: '/api/assignments/bulk',
    STATS: '/api/assignments/stats',
    WORKLOAD: '/api/assignments/workload',
    ESCALATE: '/api/assignments/:id/escalate',
    OVERDUE: '/api/assignments/overdue',
    ASSIGNABLE_USERS: '/api/assignments/assignable-users' // NEW: Get users that can be assigned tasks
  },
  UPDATES: {
    LIST: '/api/updates/',
    CREATE: '/api/updates/',
    DETAIL: '/api/updates/:id',
    BY_ISSUE: '/api/updates/issue/:id',
    RECENT: '/api/updates/recent'
  },
  USERS: {
  LIST: '/api/users/',
  CREATE: '/api/users/',
  DETAIL: '/api/users/:id',
  UPDATE: '/api/users/:id',
  DELETE: '/api/users/:id',
  STAFF: '/api/users/staff',
  SUPERVISORS: '/api/users/supervisors',  // ← ADD THIS LINE
  DEPARTMENTS: '/api/users/departments',
  STATS: '/api/users/stats',
  WORKLOAD: '/api/users/:id/workload',
  CHANGE_ROLE: '/api/users/:id/change-role'
  },
  FILES: {
    UPLOAD_IMAGE: '/api/files/upload-image',
    UPLOAD_DOCUMENT: '/api/files/upload-document',
    UPLOAD_MULTIPLE: '/api/files/upload-multiple',
    CAMERA_CAPTURE: '/api/files/camera-capture',
    DELETE: '/api/files/delete/:path',
    LIST: '/api/files/',
    INFO: '/api/files/info',
    VALIDATE: '/api/files/validate',
    CAMERA_STATUS: '/api/files/camera-status'
  },
  DASHBOARD: {
    OVERVIEW: '/api/dashboard/overview',
    TRENDS: '/api/dashboard/trends',
    ACTIVITY: '/api/dashboard/activity'
  },
  ANALYTICS: {
    OVERVIEW: '/api/analytics/overview',
    TRENDS: '/api/analytics/trends',
    DEPARTMENTS: '/api/analytics/departments',
    PERFORMANCE: '/api/analytics/performance'
  }
};

// ===== ISSUE STATUS =====
export const ISSUE_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  ESCALATED: 'escalated'
};

export const ISSUE_STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  escalated: 'Escalated'
};

// ===== SLA DEADLINES (FIXED to match both category systems) =====
export const SLA_DEADLINES = {
  // Standard categories
  roads: { low: 168, medium: 72, high: 24, urgent: 4 },
  waste: { low: 48, medium: 24, high: 8, urgent: 2 },
  water: { low: 72, medium: 48, high: 12, urgent: 4 },
  streetlight: { low: 120, medium: 72, high: 24, urgent: 8 },
  other: { low: 168, medium: 96, high: 48, urgent: 12 },
  // Load test categories (for backward compatibility)
  potholes: { low: 168, medium: 72, high: 24, urgent: 4 },
  DamagedElectricalPoles: { low: 120, medium: 72, high: 24, urgent: 8 },
  Garbage: { low: 48, medium: 24, high: 8, urgent: 2 },
  WaterLogging: { low: 72, medium: 48, high: 12, urgent: 4 },
  FallenTrees: { low: 168, medium: 96, high: 48, urgent: 12 }
};

// ===== ISSUE PRIORITIES (FIXED) =====
export const ISSUE_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent' // Changed from CRITICAL to URGENT to match SLA
};

export const ISSUE_PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent' // Changed from critical to urgent
};
export const USER_ROLES = {
  CITIZEN: 'citizen',
  STAFF: 'staff', 
  SUPERVISOR: 'supervisor',
  ADMIN: 'admin'
};

// Assignment target roles
export const ASSIGNABLE_ROLES = {
  STAFF: 'staff',
  SUPERVISOR: 'supervisor'
};

// Role permissions for assignment
export const ASSIGNMENT_PERMISSIONS = {
  CAN_ASSIGN: ['admin', 'supervisor'], // Who can assign tasks
  CAN_BE_ASSIGNED: ['staff', 'supervisor'] // Who can receive task assignments
};
export const PRIORITY_COLORS = {
  low: 'text-green-600 bg-green-100',
  medium: 'text-yellow-600 bg-yellow-100',
  high: 'text-orange-600 bg-orange-100',
  urgent: 'text-red-600 bg-red-100' // Fixed to match ISSUE_PRIORITY
};

// ===== DEPARTMENTS =====
export const DEPARTMENTS = {
  ROADS: 'Road Department',
  ELECTRICITY: 'Electricity Department', 
  SANITARY: 'Sanitary Department',
  PUBLIC_SERVICE: 'Public Service'
};

export const DEPARTMENT_LABELS = {
  'Road Department': 'Roads & Infrastructure',
  'Electricity Department': 'Electricity & Power',
  'Sanitary Department': 'Waste Management', 
  'Public Service': 'Public Services'
};

// ===== ASSIGNMENT STATUS (FIXED to match backend) =====
export const ASSIGNMENT_STATUS = {
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed'
};

export const ASSIGNMENT_STATUS_LABELS = {
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed'
};

// ===== SLA HELPER FUNCTIONS =====
export const getSLADeadline = (category, priority = 'medium') => {
  const slaConfig = SLA_DEADLINES[category];
  if (!slaConfig) return SLA_DEADLINES.other[priority] || 72;
  return slaConfig[priority] || slaConfig.medium || 72;
};

export const calculateDeadline = (category, priority = 'medium') => {
  const hours = getSLADeadline(category, priority);
  return new Date(Date.now() + hours * 60 * 60 * 1000);
};

export const isOverdue = (deadline) => {
  if (!deadline) return false;
  return new Date() > new Date(deadline);
};

export const getDaysUntilDeadline = (deadline) => {
  if (!deadline) return null;
  const diff = new Date(deadline) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// ===== ERROR MESSAGES =====
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your internet connection.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNAUTHORIZED: 'Unauthorized access. Please login again.',
  FORBIDDEN: 'Access denied. You do not have permission to perform this action.',
  NOT_FOUND: 'Resource not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  DELETE_FAILED: 'Failed to delete item. Please try again.',
  UPDATE_FAILED: 'Failed to update item. Please try again.',
  CREATE_FAILED: 'Failed to create item. Please try again.',
  FETCH_FAILED: 'Failed to fetch data. Please try again.',
  CONNECTION_ERROR: 'Connection error. Please check your internet connection.',
  PERMISSION_DENIED: 'Permission denied. Contact your administrator for access.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait and try again.',
  MAINTENANCE_MODE: 'System is under maintenance. Please try again later.',
  GENERIC_ERROR: 'Something went wrong. Please try again.',
  ASSIGNMENT_OVERDUE: 'This assignment is overdue and needs immediate attention.',
  ESCALATION_FAILED: 'Failed to escalate assignment. Please try again.',
  SLA_BREACH: 'SLA deadline has been breached for this assignment.'
};

// ===== SUCCESS MESSAGES =====
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Successfully logged in!',
  LOGOUT_SUCCESS: 'Successfully logged out!',
  SIGNUP_SUCCESS: 'Account created successfully!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  ISSUE_CREATED: 'Issue reported successfully!',
  ISSUE_UPDATED: 'Issue updated successfully!',
  ISSUE_DELETED: 'Issue deleted successfully!',
  ASSIGNMENT_CREATED: 'Task assigned successfully!',
  ASSIGNMENT_UPDATED: 'Assignment updated successfully!',
  ASSIGNMENT_ESCALATED: 'Assignment escalated successfully!',
  FILE_UPLOADED: 'File uploaded successfully!',
  SETTINGS_SAVED: 'Settings saved successfully!',
  PASSWORD_CHANGED: 'Password changed successfully!',
  EMAIL_VERIFIED: 'Email verified successfully!',
  GENERIC_SUCCESS: 'Operation completed successfully!'
};

// ===== HTTP STATUS CODES =====
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

// ===== STORAGE KEYS =====
export const STORAGE_KEYS = {
  TOKEN: 'token',
  CURRENT_USER: 'currentUser',
  THEME: 'theme',
  LANGUAGE: 'language',
  LAST_ACTIVITY: 'lastActivity'
};

// ===== DEFAULT VALUES =====
export const DEFAULT_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// ===== VALIDATION PATTERNS =====
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[+]?[\d\s\-\(\)]{10,}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/
};

// ===== PERMISSION SETS =====
export const PERMISSIONS = {
  VIEW_ALL_ISSUES: 'view-all-issues',
  MANAGE_USERS: 'manage-users',
  ASSIGN_TASKS: 'assign-tasks',
  ESCALATE_ISSUES: 'escalate-issues',
  UPDATE_STATUS: 'update-status',
  VIEW_ANALYTICS: 'view-analytics',
  MANAGE_ASSIGNMENTS: 'manage-assignments',
  SYSTEM_SETTINGS: 'system-settings',
  CREATE_ISSUES: 'create-issues',
  EDIT_ISSUES: 'edit-issues',
  DELETE_ISSUES: 'delete-issues'
};