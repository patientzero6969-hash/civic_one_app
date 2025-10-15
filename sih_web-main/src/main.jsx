import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Environment configuration
const isDevelopment = import.meta.env.MODE === 'development';
const isProduction = import.meta.env.MODE === 'production';

// Performance monitoring
const logPerformance = () => {
  if ('performance' in window && 'measure' in window.performance) {
    try {
      // Get navigation timing
      const navTiming = performance.getEntriesByType('navigation')[0];
      if (navTiming) {
        const loadTime = navTiming.loadEventEnd - navTiming.navigationStart;
        console.log(`%cApp Load Time: ${Math.round(loadTime)}ms`, 'color: #10B981; font-weight: bold');
        
        if (isDevelopment) {
          console.log('Navigation Timing Details:', {
            'DNS Lookup': `${Math.round(navTiming.domainLookupEnd - navTiming.domainLookupStart)}ms`,
            'TCP Connect': `${Math.round(navTiming.connectEnd - navTiming.connectStart)}ms`,
            'Server Response': `${Math.round(navTiming.responseEnd - navTiming.requestStart)}ms`,
            'DOM Processing': `${Math.round(navTiming.domContentLoadedEventEnd - navTiming.responseEnd)}ms`,
            'Resource Loading': `${Math.round(navTiming.loadEventEnd - navTiming.domContentLoadedEventEnd)}ms`
          });
        }
      }
    } catch (error) {
      // Performance API not available or failed
      if (isDevelopment) {
        console.warn('Performance measurement failed:', error);
      }
    }
  }
};

// Enhanced error handling
const setupErrorHandling = () => {
  // Global error handler
  window.addEventListener('error', (event) => {
    const error = {
      message: event.error?.message || event.message,
      stack: event.error?.stack,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      timestamp: new Date().toISOString()
    };

    if (isDevelopment) {
      console.error('Global JavaScript Error:', error);
    } else {
      // In production, you might want to send this to an error reporting service
      console.error('Application Error:', error.message);
      // Example: Send to error reporting service
      // sendErrorToService(error);
    }
  });

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    const error = {
      reason: event.reason,
      promise: event.promise,
      timestamp: new Date().toISOString()
    };

    if (isDevelopment) {
      console.error('Unhandled Promise Rejection:', error);
    } else {
      console.error('Promise Rejection:', error.reason);
      // Example: Send to error reporting service
      // sendErrorToService(error);
    }

    // Prevent the default browser behavior (logging to console)
    event.preventDefault();
  });
};

// API health check
const checkApiHealth = async () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://192.168.1.103:8000';
  
  try {
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      timeout: 5000 // 5 second timeout
    });
    
    if (response.ok) {
      const data = await response.json();
      if (isDevelopment) {
        console.log('%cAPI Health Check: ✓ Connected', 'color: #10B981; font-weight: bold');
        console.log('API Status:', data);
      }
    } else {
      throw new Error(`API responded with status: ${response.status}`);
    }
  } catch (error) {
    console.warn('%cAPI Health Check: ✗ Failed', 'color: #EF4444; font-weight: bold');
    console.warn('API Connection Error:', error.message);
    
    // Show user-friendly message
    if (isProduction) {
      setTimeout(() => {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 z-50 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg shadow-lg max-w-sm';
        notification.innerHTML = `
          <div class="flex items-center">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            <span class="text-sm">Unable to connect to server. Some features may be limited.</span>
          </div>
        `;
        document.body.appendChild(notification);
        
        // Remove notification after 10 seconds
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 10000);
      }, 1000);
    }
  }
};

// Service Worker registration for PWA functionality
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator && isProduction) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('Service Worker registered successfully:', registration);
      
      // Handle service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available; show update notification
              console.log('New content is available; please refresh.');
            }
          });
        }
      });
      
    } catch (error) {
      console.warn('Service Worker registration failed:', error);
    }
  }
};

// Initialize application
const initializeApp = async () => {
  // Setup error handling first
  setupErrorHandling();
  
  // Check API connectivity
  await checkApiHealth();
  
  // Register service worker
  await registerServiceWorker();
  
  // Performance monitoring
  if (document.readyState === 'complete') {
    logPerformance();
  } else {
    window.addEventListener('load', logPerformance);
  }
  
  // Development-only logs
  if (isDevelopment) {
    console.log('%cCivic Connect App Started', 'color: #3B82F6; font-size: 16px; font-weight: bold');
    console.log('Environment:', {
      mode: import.meta.env.MODE,
      apiUrl: import.meta.env.VITE_API_URL,
      version: import.meta.env.VITE_APP_VERSION || '1.0.0'
    });
  }
};

// Create and render React app
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render app with error boundary
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Initialize app after rendering
initializeApp();

// Hot module replacement for development
if (isDevelopment && import.meta.hot) {
  import.meta.hot.accept('./App.jsx', (newModule) => {
    console.log('Hot reloading App component...');
  });
}

// Expose some utilities globally for development
if (isDevelopment) {
  window.civicConnect = {
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    environment: import.meta.env.MODE,
    apiUrl: import.meta.env.VITE_API_URL || 'http://192.168.1.103:8000',
    checkApi: checkApiHealth,
    clearStorage: () => {
      localStorage.clear();
      sessionStorage.clear();
      console.log('Storage cleared');
    }
  };
}