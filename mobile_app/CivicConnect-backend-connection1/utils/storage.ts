// utils/storage.ts - Fixed TypeScript version
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface User {
  name: string;
  email: string;
  phone: string;
}

export interface Report {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  status: string;
  date: string;
  image?: string;
  updates: Array<{
    id: string;
    message: string;
    date: string;
    author: string;
  }>;
}

const USER_KEY = 'civicreport_user';
const REPORTS_KEY = 'civicreport_reports';
const AUTH_TOKEN_KEY = 'auth_token';

export const StorageService = {
  // User methods
  async saveUser(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Error saving user:', error);
    }
  },

  async getUser(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  },

  async removeUser(): Promise<void> {
    try {
      await AsyncStorage.removeItem(USER_KEY);
    } catch (error) {
      console.error('Error removing user:', error);
    }
  },

  // Auth token methods
  async saveAuthToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    } catch (error) {
      console.error('Error saving auth token:', error);
    }
  },

  async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  },

  async removeAuthToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    } catch (error) {
      console.error('Error removing auth token:', error);
    }
  },

  // Reports methods
  async saveReports(reports: Report[]): Promise<void> {
    try {
      await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    } catch (error) {
      console.error('Error saving reports:', error);
    }
  },

  async getReports(): Promise<Report[]> {
    try {
      const reportsData = await AsyncStorage.getItem(REPORTS_KEY);
      return reportsData ? JSON.parse(reportsData) : [];
    } catch (error) {
      console.error('Error getting reports:', error);
      return [];
    }
  },

  async addReport(report: Report): Promise<void> {
    try {
      const existingReports = await this.getReports();
      const updatedReports = [...existingReports, report];
      await this.saveReports(updatedReports);
    } catch (error) {
      console.error('Error adding report:', error);
    }
  },

  // Clear all data
  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([USER_KEY, REPORTS_KEY, AUTH_TOKEN_KEY]);
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  }
};