// utils/api.ts - Simple fix without token refresh complexity
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
export const API_CONFIG = {
  BASE_URL: 'http://10.191.176.176:8000', // Your computer's IP address
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/api/auth/login',
      REGISTER: '/api/auth/register',
      LOGOUT: '/api/auth/logout',
      ME: '/api/auth/me',
      VERIFY_TOKEN: '/api/auth/verify-token'
    },
    ISSUES: {
      CREATE: '/api/issues',
      LIST: '/api/issues/',  // Added trailing slash to match your backend
      BY_ID: (id: number) => `/api/issues/${id}`,
    },
    FILES: {
      UPLOAD_IMAGE: '/api/files/upload/image'
    }
  }
};

// Simple HTTP Client Class
class APIClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('auth_token');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  private async getHeaders(includeAuth: boolean = true): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = await this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        detail: 'Network error occurred' 
      }));
      
      // If we get 401, it means token is expired or invalid
      if (response.status === 401) {
        throw new Error('Session expired. Please login again.');
      }
      
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }

    return response.text() as unknown as T;
  }

  async get<T>(endpoint: string, includeAuth: boolean = true): Promise<T> {
    const headers = await this.getHeaders(includeAuth);
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      headers,
    });

    return this.handleResponse<T>(response);
  }

  async post<T>(endpoint: string, data?: any, includeAuth: boolean = true): Promise<T> {
    const headers = await this.getHeaders(includeAuth);
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async put<T>(endpoint: string, data?: any, includeAuth: boolean = true): Promise<T> {
    const headers = await this.getHeaders(includeAuth);
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string, includeAuth: boolean = true): Promise<T> {
    const headers = await this.getHeaders(includeAuth);
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers,
    });

    return this.handleResponse<T>(response);
  }

  // Special method for multipart/form-data (file uploads)
  async postFormData<T>(endpoint: string, formData: FormData, includeAuth: boolean = true): Promise<T> {
    const headers: HeadersInit = {};

    if (includeAuth) {
      const token = await this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    return this.handleResponse<T>(response);
  }
}

// Create and export the API client instance
export const apiClient = new APIClient(API_CONFIG.BASE_URL);

// Utility function to save auth token
export const saveAuthToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem('auth_token', token);
  } catch (error) {
    console.error('Error saving auth token:', error);
  }
};

// Utility function to remove auth token
export const removeAuthToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('auth_token');
  } catch (error) {
    console.error('Error removing auth token:', error);
  }
};