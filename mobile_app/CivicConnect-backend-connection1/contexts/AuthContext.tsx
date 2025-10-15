// contexts/AuthContext.tsx - Fixed TypeScript version
import React, { createContext, useContext, useEffect, useState } from 'react';
import { StorageService } from '../utils/storage';

// Configuration
const BASE_URL = 'http://10.191.176.176:8000';

// Types
interface User {
  name: string;
  email: string;
  phone: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  networkError: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  retryConnection: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [networkError, setNetworkError] = useState<boolean>(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const testNetworkConnection = async (): Promise<void> => {
    try {
      console.log('🔍 Testing network connection...');
      const testResponse = await fetch(`${BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        //timeout: 5000,
      });
      
      if (testResponse.ok) {
        const healthData = await testResponse.json();
        console.log('✅ Backend connection test:', healthData);
        setNetworkError(false);
      } else {
        throw new Error('Health check failed');
      }
    } catch (error) {
      console.error('❌ Network test failed:', error);
      setNetworkError(true);
      throw new Error('Cannot connect to server');
    }
  };

  const checkAuthStatus = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setNetworkError(false);
      
      console.log('🔍 Checking authentication status...');
      
      // Check if we have a stored user
      const storedUser = await StorageService.getUser();
      console.log('📱 Stored user:', storedUser ? 'Found' : 'Not found');
      
      if (storedUser) {
        setUser(storedUser);
        setIsAuthenticated(true);
        console.log('👤 User authenticated from storage');
      } else {
        setUser(null);
        setIsAuthenticated(false);
        console.log('❌ No stored user data');
      }
    } catch (error) {
      console.error('❌ Auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setNetworkError(true);
    } finally {
      setIsLoading(false);
      console.log('✅ Auth check completed');
    }
  };

  const retryConnection = async (): Promise<void> => {
    console.log('🔄 Retrying connection...');
    setNetworkError(false);
    await checkAuthStatus();
  };

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setNetworkError(false);
      console.log('🔐 Attempting login for:', email);
      
      // Test network connection first
      await testNetworkConnection();
      
      console.log('📡 Making login request to:', `${BASE_URL}/api/auth/login`);
      
      // Make login request
      const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: email.trim(), 
          password: password.trim() 
        }),
      });

      console.log('📡 Login response status:', loginResponse.status);
      
      if (!loginResponse.ok) {
        const errorText = await loginResponse.text();
        console.error('❌ Login error response:', errorText);
        
        if (loginResponse.status === 401) {
          throw new Error('Invalid email or password');
        } else if (loginResponse.status === 422) {
          throw new Error('Invalid request format');
        } else {
          throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
        }
      }

      const data = await loginResponse.json();
      console.log('📨 Login response data received');
      
      if (data.success && data.user) {
        const localUser: User = {
          name: data.user.full_name || 'User',
          email: email,
          phone: data.user.phone || ''
        };
        
        // Save auth token
        if (data.access_token) {
          await StorageService.saveAuthToken(data.access_token);
          console.log('🔑 Auth token saved');
        }
        
        setUser(localUser);
        setIsAuthenticated(true);
        await StorageService.saveUser(localUser);
        console.log('✅ Login successful');
      } else {
        console.error('❌ Invalid login response format:', data);
        throw new Error('Login response invalid');
      }
    } catch (error: unknown) {
      console.error('❌ Login failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('Network request failed') || 
          errorMessage.includes('fetch') ||
          errorMessage.includes('Cannot connect')) {
        setNetworkError(true);
        throw new Error('Cannot connect to server. Please check your internet connection.');
      } else if (errorMessage.includes('Invalid')) {
        throw new Error(errorMessage);
      } else {
        throw new Error(errorMessage || 'Login failed. Please try again.');
      }
    }
  };

  const register = async (userData: RegisterData): Promise<void> => {
    try {
      setNetworkError(false);
      console.log('📝 Attempting registration for:', userData.email);
      
      // Test network connection first
      await testNetworkConnection();
      
      console.log('📡 Making registration request to:', `${BASE_URL}/api/auth/register`);
      
      // Make registration request
      const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      console.log('📡 Registration response status:', registerResponse.status);

      if (!registerResponse.ok) {
        const errorText = await registerResponse.text();
        console.error('❌ Registration error response:', errorText);
        
        if (registerResponse.status === 400) {
          throw new Error('An account with this email already exists');
        } else if (registerResponse.status === 422) {
          throw new Error('Invalid registration data');
        } else {
          throw new Error(`Registration failed: ${registerResponse.status} ${registerResponse.statusText}`);
        }
      }

      const data = await registerResponse.json();
      console.log('📨 Registration response data received');
      
      if (data.success && data.user) {
        const localUser: User = {
          name: data.user.full_name || userData.full_name || 'User',
          email: userData.email,
          phone: data.user.phone || userData.phone || ''
        };
        
        // Save auth token
        if (data.access_token) {
          await StorageService.saveAuthToken(data.access_token);
          console.log('🔑 Auth token saved');
        }
        
        setUser(localUser);
        setIsAuthenticated(true);
        await StorageService.saveUser(localUser);
        console.log('✅ Registration successful');
      } else {
        console.error('❌ Invalid registration response format:', data);
        throw new Error('Registration response invalid');
      }
    } catch (error: unknown) {
      console.error('❌ Registration failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('Network request failed') || 
          errorMessage.includes('fetch') ||
          errorMessage.includes('Cannot connect')) {
        setNetworkError(true);
        throw new Error('Cannot connect to server. Please check your internet connection.');
      } else if (errorMessage.includes('already exists')) {
        throw new Error('An account with this email already exists. Please try logging in instead.');
      } else {
        throw new Error(errorMessage || 'Registration failed. Please try again.');
      }
    }
  };

  const logout = async (): Promise<void> => {
    try {
      console.log('🚪 Logging out...');
      
      // Optional: Call backend logout endpoint
      try {
        const token = await StorageService.getAuthToken();
        if (token) {
          await fetch(`${BASE_URL}/api/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
        }
      } catch (logoutError) {
        console.warn('❌ Backend logout failed:', logoutError);
        // Continue with local logout even if backend fails
      }
      
      await StorageService.clearAllData();
      setUser(null);
      setIsAuthenticated(false);
      setNetworkError(false);
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Force logout even if there's an error
      setUser(null);
      setIsAuthenticated(false);
      setNetworkError(false);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    networkError,
    login,
    register,
    logout,
    retryConnection,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};