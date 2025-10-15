import {
    ISSUE_STATUSES,
    ISSUE_PRIORITIES,
    ASSIGNMENT_STATUSES,
    SLA_CONFIG,
    VALIDATION_RULES,
    ERROR_MESSAGES,
    STATUS_COLORS,
    PRIORITY_COLORS,
    DATE_FORMATS,
    USER_ROLES,
    API_CONFIG
} from './constants';

// API utility functions
export const apiRequest = async (url, options = {}, token = null) => {
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
        ...options,
    };

    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}${url}`, config);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        
        return response.json();
    } catch (error) {
        console.error('API Request failed:', error);
        throw error;
    }
};

// Date and time utilities
export const formatDate = (dateString, format = DATE_FORMATS.DISPLAY) => {
    if (!dateString) return 'N/A';

    try {
        const date = new Date(dateString);

        switch (format) {
            case DATE_FORMATS.DISPLAY:
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            case DATE_FORMATS.DATETIME_DISPLAY:
                return date.toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
            case DATE_FORMATS.TIME_DISPLAY:
                return date.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
            case DATE_FORMATS.INPUT:
                return date.toISOString().split('T')[0];
            case DATE_FORMATS.ISO:
                return date.toISOString();
            default:
                return date.toLocaleDateString();
        }
    } catch (error) {
        console.error('Date formatting error:', error);
        return 'Invalid Date';
    }
};

export const formatRelativeTime = (dateString) => {
    if (!dateString) return 'Unknown';

    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMs = now - date;
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
        if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
        if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;

        return formatDate(dateString);
    } catch (error) {
        console.error('Relative time formatting error:', error);
        return 'Invalid Date';
    }
};

export const calculateDaysBetween = (startDate, endDate = new Date()) => {
    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffInMs = end - start;
        return Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
    } catch (error) {
        return 0;
    }
};

export const isOverdue = (issue) => {
    if (issue.status === ISSUE_STATUSES.RESOLVED) return false;

    let deadline;
    if (issue.deadline) {
        deadline = new Date(issue.deadline);
    } else if (issue.created_at) {
        deadline = new Date(issue.created_at);
        const slaHours = getSLAHours(issue.priority);
        deadline.setHours(deadline.getHours() + slaHours);
    } else {
        return false;
    }

    return new Date() > deadline;
};

export const getOverdueDays = (issue) => {
    if (!isOverdue(issue)) return 0;

    let deadline;
    if (issue.deadline) {
        deadline = new Date(issue.deadline);
    } else if (issue.created_at) {
        deadline = new Date(issue.created_at);
        const slaHours = getSLAHours(issue.priority);
        deadline.setHours(deadline.getHours() + slaHours);
    } else {
        return 0;
    }

    return calculateDaysBetween(deadline);
};

export const getSLAHours = (priority) => {
    switch (priority) {
        case ISSUE_PRIORITIES.HIGH:
            return SLA_CONFIG.HIGH_PRIORITY_HOURS;
        case ISSUE_PRIORITIES.MEDIUM:
            return SLA_CONFIG.MEDIUM_PRIORITY_HOURS;
        case ISSUE_PRIORITIES.LOW:
            return SLA_CONFIG.LOW_PRIORITY_HOURS;
        default:
            return SLA_CONFIG.DEFAULT_HOURS;
    }
};

// Validation utilities
export const validateEmail = (email) => {
    if (!email) return ERROR_MESSAGES.REQUIRED_FIELD;
    if (!VALIDATION_RULES.EMAIL_REGEX.test(email)) return ERROR_MESSAGES.INVALID_EMAIL;
    return null;
};

export const validatePassword = (password) => {
    if (!password) return ERROR_MESSAGES.REQUIRED_FIELD;
    if (password.length < VALIDATION_RULES.PASSWORD_MIN_LENGTH) return ERROR_MESSAGES.PASSWORD_TOO_SHORT;
    return null;
};

export const validateName = (name) => {
    if (!name) return ERROR_MESSAGES.REQUIRED_FIELD;
    if (name.length < VALIDATION_RULES.NAME_MIN_LENGTH) return ERROR_MESSAGES.NAME_TOO_SHORT;
    if (name.length > VALIDATION_RULES.NAME_MAX_LENGTH) return ERROR_MESSAGES.NAME_TOO_LONG;
    return null;
};

export const validatePhone = (phone) => {
    if (!phone) return null; // Phone is optional
    const digits = phone.replace(/\D/g, '');
    if (digits.length < VALIDATION_RULES.PHONE_MIN_LENGTH || digits.length > VALIDATION_RULES.PHONE_MAX_LENGTH) {
        return ERROR_MESSAGES.PHONE_INVALID;
    }
    return null;
};

export const validateRequired = (value, fieldName = 'Field') => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
        return `${fieldName} is required`;
    }
    return null;
};

// UI utility functions
export const getStatusColor = (status) => {
    return STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';
};

export const getPriorityColor = (priority) => {
    return PRIORITY_COLORS[priority] || 'text-gray-600';
};

export const getSeverityColor = (days) => {
    if (days > 7) return 'bg-red-100 text-red-800 border-red-200';
    if (days > 3) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
};

export const getStatusIcon = (status) => {
    const icons = {
        [ISSUE_STATUSES.PENDING]: '🔴',
        [ISSUE_STATUSES.IN_PROGRESS]: '🟡',
        [ISSUE_STATUSES.RESOLVED]: '🟢',
        [ASSIGNMENT_STATUSES.ASSIGNED]: '🔵',
        [ASSIGNMENT_STATUSES.IN_PROGRESS]: '🟡',
        [ASSIGNMENT_STATUSES.COMPLETED]: '🟢'
    };
    return icons[status] || '⚪';
};

export const getPriorityIcon = (priority) => {
    const icons = {
        [ISSUE_PRIORITIES.LOW]: '🔽',
        [ISSUE_PRIORITIES.MEDIUM]: '➡️',
        [ISSUE_PRIORITIES.HIGH]: '🔺'
    };
    return icons[priority] || '➡️';
};

// String utilities
export const truncateText = (text, maxLength = 50) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
};

export const capitalizeFirst = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const capitalizeWords = (str) => {
    if (!str) return '';
    return str.split(' ').map(word => capitalizeFirst(word)).join(' ');
};

export const formatCategoryName = (category) => {
    if (!category) return '';
    return capitalizeFirst(category);
};

export const formatStatusName = (status) => {
    if (!status) return '';
    return status.split('_').map(word => capitalizeFirst(word)).join(' ');
};

export const generateId = (prefix = 'id') => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    return `${prefix}-${timestamp}-${random}`;
};

// Array utilities
export const groupBy = (array, key) => {
    return array.reduce((result, item) => {
        const groupKey = typeof key === 'function' ? key(item) : item[key];
        if (!result[groupKey]) {
            result[groupKey] = [];
        }
        result[groupKey].push(item);
        return result;
    }, {});
};

export const sortBy = (array, key, direction = 'asc') => {
    return [...array].sort((a, b) => {
        const valueA = typeof key === 'function' ? key(a) : a[key];
        const valueB = typeof key === 'function' ? key(b) : b[key];

        if (valueA < valueB) return direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return direction === 'asc' ? 1 : -1;
        return 0;
    });
};

export const filterBy = (array, filters) => {
    return array.filter(item => {
        return Object.keys(filters).every(key => {
            const filterValue = filters[key];
            if (!filterValue) return true;

            const itemValue = item[key];
            if (typeof filterValue === 'string') {
                return itemValue && itemValue.toLowerCase().includes(filterValue.toLowerCase());
            }
            return itemValue === filterValue;
        });
    });
};

export const removeDuplicates = (array, key) => {
    if (!key) return [...new Set(array)];

    const seen = new Set();
    return array.filter(item => {
        const value = typeof key === 'function' ? key(item) : item[key];
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
    });
};

// File utilities
export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const validateFileType = (file, allowedTypes) => {
    return allowedTypes.includes(file.type);
};

export const validateFileSize = (file, maxSizeInMB) => {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return file.size <= maxSizeInBytes;
};

export const readFileAsDataURL = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
};

// Number utilities
export const formatNumber = (num, decimals = 0) => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
};

export const formatPercentage = (value, decimals = 1) => {
    if (value === null || value === undefined || isNaN(value)) return '0%';
    return `${(value * 100).toFixed(decimals)}%`;
};

export const clamp = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
};

// Statistics utilities
export const calculateAverage = (array, key) => {
    if (array.length === 0) return 0;

    const sum = array.reduce((total, item) => {
        const value = typeof key === 'function' ? key(item) : (key ? item[key] : item);
        return total + (parseFloat(value) || 0);
    }, 0);

    return sum / array.length;
};

export const calculateSum = (array, key) => {
    return array.reduce((total, item) => {
        const value = typeof key === 'function' ? key(item) : (key ? item[key] : item);
        return total + (parseFloat(value) || 0);
    }, 0);
};

export const calculatePercentage = (part, total) => {
    if (total === 0) return 0;
    return (part / total) * 100;
};

// Issue-specific utilities
export const calculateResolutionTime = (issue) => {
    if (!issue.created_at || !issue.updated_at || issue.status !== ISSUE_STATUSES.RESOLVED) {
        return null;
    }

    const created = new Date(issue.created_at);
    const resolved = new Date(issue.updated_at);
    const diffInMs = resolved - created;
    const diffInHours = Math.round(diffInMs / (1000 * 60 * 60));

    return diffInHours;
};

export const getIssueSeverity = (issue) => {
    const overdueDays = getOverdueDays(issue);

    if (overdueDays > 7) return 'critical';
    if (overdueDays > 3) return 'high';
    if (overdueDays > 0) return 'medium';
    return 'normal';
};

export const getIssueDeadline = (issue) => {
    if (issue.deadline) {
        return new Date(issue.deadline);
    }

    if (issue.created_at) {
        const deadline = new Date(issue.created_at);
        const slaHours = getSLAHours(issue.priority);
        deadline.setHours(deadline.getHours() + slaHours);
        return deadline;
    }

    return null;
};

// Role-based utilities
export const canUserAccessResource = (user, permission) => {
    if (!user || !user.role) return false;

    const rolePermissions = {
        [USER_ROLES.ADMIN]: ['all'],
        [USER_ROLES.SUPERVISOR]: ['view_department', 'manage_issues', 'assign_tasks', 'escalate_issues'],
        [USER_ROLES.STAFF]: ['view_assigned', 'update_status', 'create_updates'],
        [USER_ROLES.CITIZEN]: ['view_own', 'create_issues', 'vote_issues']
    };

    const userPermissions = rolePermissions[user.role] || [];
    return userPermissions.includes('all') || userPermissions.includes(permission);
};

export const getDashboardRoute = (role) => {
    const routes = {
        [USER_ROLES.ADMIN]: '/admin-dashboard',
        [USER_ROLES.SUPERVISOR]: '/supervisor-dashboard',
        [USER_ROLES.STAFF]: '/staff-dashboard',
        [USER_ROLES.CITIZEN]: '/citizen-dashboard'
    };

    return routes[role] || '/login';
};

export const canManageIssue = (user) => {
    return user?.role === USER_ROLES.ADMIN || user?.role === USER_ROLES.SUPERVISOR;
};

export const canUpdateStatus = (user) => {
    return user?.role === USER_ROLES.ADMIN || 
           user?.role === USER_ROLES.SUPERVISOR ||
           user?.role === USER_ROLES.STAFF;
};

export const canAddUpdate = (user) => {
    return user?.role === USER_ROLES.ADMIN || 
           user?.role === USER_ROLES.SUPERVISOR ||
           user?.role === USER_ROLES.STAFF;
};

export const canVoteOnIssues = (user) => {
    return user?.role === USER_ROLES.CITIZEN;
};

// Geolocation utilities
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
};

export const isValidCoordinates = (lat, lng) => {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

export const formatDistance = (distance_km) => {
    if (distance_km < 1) {
        const meters = Math.round(distance_km * 1000);
        return `${meters} m`;
    } else if (distance_km < 100) {
        return `${distance_km.toFixed(1)} km`;
    } else {
        return `${Math.round(distance_km)} km`;
    }
};

// Error handling utilities
export const handleApiError = (error) => {
    if (error.message.includes('401')) {
        return 'Authentication required. Please log in.';
    } else if (error.message.includes('403')) {
        return 'You do not have permission to perform this action.';
    } else if (error.message.includes('404')) {
        return 'The requested resource was not found.';
    } else if (error.message.includes('429')) {
        return 'Too many requests. Please try again later.';
    } else if (error.message.includes('500')) {
        return 'Server error. Please try again later.';
    } else if (error.message.includes('Network')) {
        return 'Network error. Please check your connection.';
    } else {
        return error.message || 'An unexpected error occurred.';
    }
};

// Debounce and throttle utilities
export const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
};

export const throttle = (func, delay) => {
    let lastCall = 0;
    return (...args) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            return func.apply(null, args);
        }
    };
};

// Deep clone utility
export const deepClone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const copy = {};
        Object.keys(obj).forEach(key => {
            copy[key] = deepClone(obj[key]);
        });
        return copy;
    }
};

// CSV export utility
export const exportToCSV = (data, filename = 'export.csv') => {
    if (!data.length) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row =>
            headers.map(header => {
                const value = row[header] || '';
                // Escape commas and quotes in CSV
                return typeof value === 'string' && (value.includes(',') || value.includes('"'))
                    ? `"${value.replace(/"/g, '""')}"`
                    : value;
            }).join(',')
        )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Token utilities
export const isTokenExpired = (token) => {
    if (!token) return true;
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;
        return payload.exp < currentTime;
    } catch (error) {
        return true;
    }
};

export const getTokenPayload = (token) => {
    if (!token) return null;
    
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (error) {
        return null;
    }
};

// Default export with commonly used utilities
export default {
    apiRequest,
    formatDate,
    formatRelativeTime,
    calculateDaysBetween,
    isOverdue,
    getOverdueDays,
    getSLAHours,
    validateEmail,
    validatePassword,
    validateName,
    validatePhone,
    validateRequired,
    getStatusColor,
    getPriorityColor,
    getSeverityColor,
    formatCategoryName,
    formatStatusName,
    truncateText,
    capitalizeFirst,
    capitalizeWords,
    generateId,
    groupBy,
    sortBy,
    filterBy,
    formatNumber,
    formatPercentage,
    calculateAverage,
    canUserAccessResource,
    getDashboardRoute,
    canManageIssue,
    canUpdateStatus,
    canAddUpdate,
    canVoteOnIssues,
    calculateDistance,
    isValidCoordinates,
    formatDistance,
    handleApiError,
    debounce,
    throttle,
    deepClone,
    exportToCSV,
    isTokenExpired,
    getTokenPayload
};