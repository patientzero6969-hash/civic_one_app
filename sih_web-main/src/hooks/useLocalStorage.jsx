import { useState, useEffect, useCallback } from 'react';

// Configuration for localStorage with backend integration
const STORAGE_KEYS = {
  AUTH_TOKEN: 'token',
  CURRENT_USER: 'currentUser',
  USER_PREFERENCES: 'userPreferences',
  CACHE_PREFIX: 'civic_cache_',
  APP_SETTINGS: 'appSettings'
};

// Default expiry times (in milliseconds)
const DEFAULT_EXPIRY = {
  AUTH_DATA: 24 * 60 * 60 * 1000, // 24 hours
  CACHE_DATA: 60 * 60 * 1000,     // 1 hour
  USER_PREFS: 30 * 24 * 60 * 60 * 1000, // 30 days
  TEMP_DATA: 15 * 60 * 1000       // 15 minutes
};

export const useLocalStorage = (key, initialValue) => {
  // Get initial value from localStorage or use provided initial value
  const [storedValue, setStoredValue] = useState(() => {
    try {
      if (typeof window === 'undefined') {
        return initialValue;
      }

      const item = window.localStorage.getItem(key);
      
      if (!item) {
        return initialValue;
      }

      const parsedItem = JSON.parse(item);
      
      // Check if the item has expiry and if it's expired
      if (parsedItem.expiry && new Date().getTime() > parsedItem.expiry) {
        window.localStorage.removeItem(key);
        return initialValue;
      }
      
      // Return the actual value if it has expiry structure, otherwise return as-is
      return parsedItem.value !== undefined ? parsedItem.value : parsedItem;
      
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = useCallback((value, expiryInMs = null) => {
    try {
      if (typeof window === 'undefined') {
        console.warn('localStorage is not available in this environment');
        return;
      }

      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      setStoredValue(valueToStore);
      
      // Prepare the item to store
      let itemToStore;
      
      if (expiryInMs) {
        itemToStore = {
          value: valueToStore,
          expiry: new Date().getTime() + expiryInMs,
          timestamp: new Date().getTime()
        };
      } else {
        itemToStore = valueToStore;
      }
      
      // Save to localStorage
      if (valueToStore === undefined) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, JSON.stringify(itemToStore));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  // Function to check if the stored value is expired
  const isExpired = useCallback(() => {
    try {
      if (typeof window === 'undefined') return false;
      
      const item = window.localStorage.getItem(key);
      if (!item) return true;
      
      const parsedItem = JSON.parse(item);
      return parsedItem.expiry && new Date().getTime() > parsedItem.expiry;
    } catch (error) {
      return true;
    }
  }, [key]);

  // Function to get remaining time until expiry
  const getTimeUntilExpiry = useCallback(() => {
    try {
      if (typeof window === 'undefined') return null;
      
      const item = window.localStorage.getItem(key);
      if (!item) return null;
      
      const parsedItem = JSON.parse(item);
      if (!parsedItem.expiry) return null;
      
      const remaining = parsedItem.expiry - new Date().getTime();
      return remaining > 0 ? remaining : 0;
    } catch (error) {
      return null;
    }
  }, [key]);

  return [storedValue, setValue, isExpired, getTimeUntilExpiry];
};

// Specialized hook for authentication data
export const useAuthStorage = () => {
  const [token, setToken] = useLocalStorage(STORAGE_KEYS.AUTH_TOKEN, null);
  const [currentUser, setCurrentUser] = useLocalStorage(STORAGE_KEYS.CURRENT_USER, null);

  const setAuthData = useCallback((tokenValue, userData) => {
    setToken(tokenValue, DEFAULT_EXPIRY.AUTH_DATA);
    setCurrentUser(userData, DEFAULT_EXPIRY.AUTH_DATA);
  }, [setToken, setCurrentUser]);

  const clearAuthData = useCallback(() => {
    setToken(undefined);
    setCurrentUser(undefined);
    // Also clear any cached API data when user logs out
    clearCachedData();
  }, [setToken, setCurrentUser]);

  const isAuthenticated = useCallback(() => {
    return token && currentUser && !isTokenExpired();
  }, [token, currentUser]);

  const isTokenExpired = useCallback(() => {
    if (!token) return true;
    
    try {
      // Simple JWT expiry check (you might want to use a JWT library)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch (error) {
      return true;
    }
  }, [token]);

  return {
    token,
    currentUser,
    setAuthData,
    clearAuthData,
    isAuthenticated,
    isTokenExpired
  };
};

// Hook for caching API responses
export const useApiCache = (cacheKey, expiryTime = DEFAULT_EXPIRY.CACHE_DATA) => {
  const fullKey = `${STORAGE_KEYS.CACHE_PREFIX}${cacheKey}`;
  const [cachedData, setCachedData, isExpired] = useLocalStorage(fullKey, null);

  const setCacheData = useCallback((data) => {
    setCachedData(data, expiryTime);
  }, [setCachedData, expiryTime]);

  const getCachedData = useCallback(() => {
    if (isExpired()) {
      return null;
    }
    return cachedData;
  }, [cachedData, isExpired]);

  const clearCache = useCallback(() => {
    setCachedData(undefined);
  }, [setCachedData]);

  return {
    data: getCachedData(),
    setData: setCacheData,
    clearData: clearCache,
    isExpired: isExpired()
  };
};

// Hook for user preferences
export const useUserPreferences = () => {
  const [preferences, setPreferences] = useLocalStorage(
    STORAGE_KEYS.USER_PREFERENCES, 
    {
      theme: 'light',
      language: 'en',
      notifications: {
        email: true,
        push: true,
        inApp: true
      },
      dashboard: {
        autoRefresh: true,
        refreshInterval: 300000, // 5 minutes
        defaultView: 'overview'
      },
      map: {
        defaultZoom: 13,
        showAllIssues: true,
        clusterMarkers: true
      }
    }
  );

  const updatePreference = useCallback((key, value) => {
    setPreferences(prev => ({
      ...prev,
      [key]: typeof value === 'object' ? { ...prev[key], ...value } : value
    }), DEFAULT_EXPIRY.USER_PREFS);
  }, [setPreferences]);

  const resetPreferences = useCallback(() => {
    setPreferences(undefined);
  }, [setPreferences]);

  return {
    preferences,
    updatePreference,
    resetPreferences
  };
};

// Hook for managing arrays in localStorage with common array operations
export const useLocalStorageArray = (key, initialValue = []) => {
  const [array, setArray] = useLocalStorage(key, initialValue);

  const addItem = useCallback((item) => {
    setArray(prev => [...prev, item]);
  }, [setArray]);

  const removeItem = useCallback((index) => {
    setArray(prev => prev.filter((_, i) => i !== index));
  }, [setArray]);

  const removeItemById = useCallback((id, idField = 'id') => {
    setArray(prev => prev.filter(item => item[idField] !== id));
  }, [setArray]);

  const updateItem = useCallback((index, updates) => {
    setArray(prev => prev.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ));
  }, [setArray]);

  const updateItemById = useCallback((id, updates, idField = 'id') => {
    setArray(prev => prev.map(item => 
      item[idField] === id ? { ...item, ...updates } : item
    ));
  }, [setArray]);

  const findItem = useCallback((predicate) => {
    return array.find(predicate);
  }, [array]);

  const findItemById = useCallback((id, idField = 'id') => {
    return array.find(item => item[idField] === id);
  }, [array]);

  const clear = useCallback(() => {
    setArray([]);
  }, [setArray]);

  const sortItems = useCallback((compareFn) => {
    setArray(prev => [...prev].sort(compareFn));
  }, [setArray]);

  return {
    items: array,
    setItems: setArray,
    addItem,
    removeItem,
    removeItemById,
    updateItem,
    updateItemById,
    findItem,
    findItemById,
    sortItems,
    clear,
    length: array.length
  };
};

// Hook for managing objects in localStorage
export const useLocalStorageObject = (key, initialValue = {}) => {
  const [object, setObject] = useLocalStorage(key, initialValue);

  const updateProperty = useCallback((property, value) => {
    setObject(prev => ({ ...prev, [property]: value }));
  }, [setObject]);

  const updateProperties = useCallback((updates) => {
    setObject(prev => ({ ...prev, ...updates }));
  }, [setObject]);

  const removeProperty = useCallback((property) => {
    setObject(prev => {
      const newObj = { ...prev };
      delete newObj[property];
      return newObj;
    });
  }, [setObject]);

  const clear = useCallback(() => {
    setObject({});
  }, [setObject]);

  const hasProperty = useCallback((property) => {
    return object.hasOwnProperty(property);
  }, [object]);

  return {
    object,
    setObject,
    updateProperty,
    updateProperties,
    removeProperty,
    clear,
    hasProperty
  };
};

// Utility functions for app data management
export const clearAllAppData = () => {
  if (typeof window === 'undefined') return;
  
  const keysToKeep = [STORAGE_KEYS.USER_PREFERENCES]; // Keep user preferences
  
  try {
    // Get all localStorage keys
    const allKeys = Object.keys(localStorage);
    
    // Remove all keys except the ones to keep
    allKeys.forEach(key => {
      if (!keysToKeep.includes(key) && !key.startsWith('_')) { // Keep system keys
        localStorage.removeItem(key);
      }
    });
    
    console.log('App data cleared successfully');
    return true;
  } catch (error) {
    console.error('Error clearing app data:', error);
    return false;
  }
};

// Clear only cached API data
export const clearCachedData = () => {
  if (typeof window === 'undefined') return;
  
  try {
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      if (key.startsWith(STORAGE_KEYS.CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('Cached data cleared successfully');
    return true;
  } catch (error) {
    console.error('Error clearing cached data:', error);
    return false;
  }
};

// Export app data for backup
export const exportAppData = () => {
  if (typeof window === 'undefined') return null;
  
  const appKeys = [
    STORAGE_KEYS.USER_PREFERENCES,
    STORAGE_KEYS.APP_SETTINGS
  ];

  const appData = {
    exportDate: new Date().toISOString(),
    version: '1.0.0'
  };
  
  appKeys.forEach(key => {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        appData[key] = JSON.parse(item);
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
    }
  });

  return appData;
};

// Import app data from backup
export const importAppData = (data) => {
  if (typeof window === 'undefined') return false;
  
  try {
    Object.keys(data).forEach(key => {
      if (key !== 'exportDate' && key !== 'version') {
        localStorage.setItem(key, JSON.stringify(data[key]));
      }
    });
    
    console.log('App data imported successfully');
    return true;
  } catch (error) {
    console.error('Error importing app data:', error);
    return false;
  }
};

// Get storage usage information
export const getStorageInfo = () => {
  if (typeof window === 'undefined') return null;
  
  try {
    const totalSize = new Blob(Object.values(localStorage)).size;
    const itemCount = localStorage.length;
    
    // Estimate quota (5MB is typical)
    const estimatedQuota = 5 * 1024 * 1024;
    const usagePercentage = (totalSize / estimatedQuota) * 100;
    
    return {
      totalSize,
      itemCount,
      usagePercentage: Math.round(usagePercentage * 100) / 100,
      formattedSize: formatBytes(totalSize)
    };
  } catch (error) {
    console.error('Error getting storage info:', error);
    return null;
  }
};

// Helper function to format bytes
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Storage event listener hook
export const useStorageListener = (key, callback) => {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleStorageChange = (e) => {
      if (e.key === key) {
        callback(e.newValue, e.oldValue);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, callback]);
};

// Hook for temporary data that should be cleared on app close
export const useSessionData = (key, initialValue) => {
  const [value, setValue] = useState(() => {
    try {
      if (typeof window === 'undefined') return initialValue;
      
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading sessionStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setSessionValue = useCallback((newValue) => {
    try {
      if (typeof window === 'undefined') return;
      
      const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
      setValue(valueToStore);
      
      if (valueToStore === undefined) {
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting sessionStorage key "${key}":`, error);
    }
  }, [key, value]);

  return [value, setSessionValue];
};

// Hook for offline data management
export const useOfflineStorage = (key, initialValue = []) => {
  const [offlineData, setOfflineData] = useLocalStorage(`offline_${key}`, initialValue);

  const addOfflineItem = useCallback((item) => {
    const offlineItem = {
      ...item,
      _offline: true,
      _timestamp: Date.now(),
      _id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    setOfflineData(prev => [...prev, offlineItem]);
    return offlineItem._id;
  }, [setOfflineData]);

  const removeOfflineItem = useCallback((offlineId) => {
    setOfflineData(prev => prev.filter(item => item._id !== offlineId));
  }, [setOfflineData]);

  const clearOfflineData = useCallback(() => {
    setOfflineData([]);
  }, [setOfflineData]);

  const getOfflineItems = useCallback(() => {
    return offlineData.filter(item => item._offline);
  }, [offlineData]);

  return {
    offlineData,
    addOfflineItem,
    removeOfflineItem,
    clearOfflineData,
    getOfflineItems,
    hasOfflineData: offlineData.length > 0
  };
};

// Performance monitoring for localStorage operations
export const useStoragePerformance = () => {
  const [performanceData, setPerformanceData] = useState({
    reads: 0,
    writes: 0,
    errors: 0,
    totalTime: 0
  });

  const measureOperation = useCallback((operation, key) => {
    const startTime = performance.now();
    
    return {
      end: (success = true) => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        setPerformanceData(prev => ({
          ...prev,
          [operation === 'read' ? 'reads' : 'writes']: prev[operation === 'read' ? 'reads' : 'writes'] + 1,
          errors: success ? prev.errors : prev.errors + 1,
          totalTime: prev.totalTime + duration
        }));
      }
    };
  }, []);

  const resetPerformanceData = useCallback(() => {
    setPerformanceData({
      reads: 0,
      writes: 0,
      errors: 0,
      totalTime: 0
    });
  }, []);

  return {
    performanceData,
    measureOperation,
    resetPerformanceData,
    averageTime: performanceData.reads + performanceData.writes > 0 
      ? performanceData.totalTime / (performanceData.reads + performanceData.writes)
      : 0
  };
};

// Development helper for localStorage debugging
export const useStorageDebug = (enabled = process.env.NODE_ENV === 'development') => {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const originalSetItem = localStorage.setItem;
    const originalGetItem = localStorage.getItem;
    const originalRemoveItem = localStorage.removeItem;

    localStorage.setItem = function(key, value) {
      console.log(`[localStorage] SET: ${key}`, value);
      return originalSetItem.call(this, key, value);
    };

    localStorage.getItem = function(key) {
      const value = originalGetItem.call(this, key);
      console.log(`[localStorage] GET: ${key}`, value);
      return value;
    };

    localStorage.removeItem = function(key) {
      console.log(`[localStorage] REMOVE: ${key}`);
      return originalRemoveItem.call(this, key);
    };

    return () => {
      localStorage.setItem = originalSetItem;
      localStorage.getItem = originalGetItem;
      localStorage.removeItem = originalRemoveItem;
    };
  }, [enabled]);
};

// Export commonly used storage keys
export { STORAGE_KEYS, DEFAULT_EXPIRY };

export default useLocalStorage;