// services/authService.ts
import { API_CONFIG, apiClient, removeAuthToken, saveAuthToken } from '../utils/api';

// Types for API responses
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: 'citizen' | 'admin' | 'supervisor' | 'staff';
  department: string | null;
  created_at: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  access_token: string;
  token_type: string;
  user: UserProfile;
}

export interface TokenVerificationResponse {
  valid: boolean;
  user?: UserProfile;
}

export interface BaseResponse {
  success: boolean;
  message?: string;
}

export class AuthService {
  /**
   * Login user with email and password
   */
  static async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>(
        API_CONFIG.ENDPOINTS.AUTH.LOGIN,
        credentials,
        false // Don't include auth header for login
      );

      // Save the token for future requests
      if (response.access_token) {
        await saveAuthToken(response.access_token);
      }

      return response;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Register new user
   */
  static async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>(
        API_CONFIG.ENDPOINTS.AUTH.REGISTER,
        userData,
        false // Don't include auth header for registration
      );

      // Save the token for future requests
      if (response.access_token) {
        await saveAuthToken(response.access_token);
      }

      return response;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  }

  /**
   * Logout current user
   */
  static async logout(): Promise<BaseResponse> {
    try {
      const response = await apiClient.post<BaseResponse>(
        API_CONFIG.ENDPOINTS.AUTH.LOGOUT
      );

      // Remove the token from storage
      await removeAuthToken();

      return response;
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if the API call fails, we should still remove the local token
      await removeAuthToken();
      throw error;
    }
  }

  /**
   * Get current user profile
   */
  static async getCurrentUser(): Promise<UserProfile> {
    try {
      const response = await apiClient.get<UserProfile>(
        API_CONFIG.ENDPOINTS.AUTH.ME
      );
      return response;
    } catch (error) {
      console.error('Get current user failed:', error);
      throw error;
    }
  }

  /**
   * Verify if current token is valid
   */
  static async verifyToken(): Promise<TokenVerificationResponse> {
    try {
      const response = await apiClient.post<TokenVerificationResponse>(
        API_CONFIG.ENDPOINTS.AUTH.VERIFY_TOKEN
      );
      return response;
    } catch (error) {
      console.error('Token verification failed:', error);
      return { valid: false };
    }
  }

  /**
   * Check if user is authenticated (has valid token)
   */
  static async isAuthenticated(): Promise<boolean> {
    try {
      const result = await this.verifyToken();
      return result.valid;
    } catch (error) {
      return false;
    }
  }
}

export default AuthService;