// services/issueService.ts
import { API_CONFIG, apiClient } from '../utils/api';

// Types for Issue API
export interface IssueCreateRequest {
  title: string;
  description: string;
  category: 'potholes' | 'DamagedElectricityPoles' | 'Garbage' | 'WaterLogging' | 'FallenTrees';
  latitude?: number;
  longitude?: number;
  image_url?: string;
}

export interface IssueResponse {
  id: number;
  title: string;
  description: string;
  category: 'potholes' | 'DamagedElectricityPoles' | 'Garbage' | 'WaterLogging' | 'FallenTrees';
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  citizen_id: string;
  status: 'pending' | 'in_progress' | 'resolved';
  upvotes: number;
  created_at: string;
  updated_at: string;
  citizen_name: string | null;
  citizen_phone: string | null;
  assignment_count: number;
  update_count: number;
  days_open: number;
  user_has_voted: boolean;
}

export interface IssueListResponse {
  success: boolean;
  message?: string;
  issues: IssueResponse[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface FileUploadResponse {
  success: boolean;
  message?: string;
  file_url: string;
  file_name: string;
  file_size: number;
  content_type: string;
}

export interface CreateIssueWithImageRequest {
  title: string;
  description: string;
  category: 'potholes' | 'DamagedElectricityPoles' | 'Garbage' | 'WaterLogging' | 'FallenTrees';
  latitude?: number;
  longitude?: number;
  imageUri?: string; // Local image URI
}

export class IssueService {
  /**
   * Upload an image file and return the URL
   */
  static async uploadImage(imageUri: string): Promise<string> {
    try {
      const formData = new FormData();
      
      // Create file object from URI
      const fileExtension = imageUri.split('.').pop() || 'jpg';
      const fileName = `issue_${Date.now()}.${fileExtension}`;
      
      formData.append('file', {
        uri: imageUri,
        type: `image/${fileExtension}`,
        name: fileName,
      } as any);

      // Optional compression settings
      formData.append('compress', 'true');
      formData.append('max_width', '1920');
      formData.append('max_height', '1080');
      formData.append('quality', '85');

      const response = await apiClient.postFormData<FileUploadResponse>(
        API_CONFIG.ENDPOINTS.FILES.UPLOAD_IMAGE,
        formData
      );

      return response.file_url;
    } catch (error) {
      console.error('Image upload failed:', error);
      throw new Error('Failed to upload image. Please try again.');
    }
  }

  /**
   * Create a new issue
   */
  static async createIssue(issueData: IssueCreateRequest): Promise<IssueResponse> {
    try {
      const response = await apiClient.post<IssueResponse>(
        API_CONFIG.ENDPOINTS.ISSUES.CREATE,
        issueData
      );
      return response;
    } catch (error) {
      console.error('Issue creation failed:', error);
      throw error;
    }
  }

  /**
   * Create an issue with image upload
   */
  static async createIssueWithImage(issueData: CreateIssueWithImageRequest): Promise<IssueResponse> {
    try {
      let imageUrl: string | undefined;

      // Upload image first if provided
      if (issueData.imageUri) {
        imageUrl = await this.uploadImage(issueData.imageUri);
      }

      // Create the issue with the uploaded image URL
      const issueRequest: IssueCreateRequest = {
        title: issueData.title,
        description: issueData.description,
        category: issueData.category,
        latitude: issueData.latitude,
        longitude: issueData.longitude,
        image_url: imageUrl,
      };

      return await this.createIssue(issueRequest);
    } catch (error) {
      console.error('Issue creation with image failed:', error);
      throw error;
    }
  }

  /**
   * Get list of issues with optional filters
   */
  static async getIssues(params?: {
    status?: 'pending' | 'in_progress' | 'resolved';
    category?: 'potholes' | 'DamagedElectricityPoles' | 'Garbage' | 'WaterLogging' | 'FallenTrees';
    page?: number;
    per_page?: number;
    search?: string;
  }): Promise<IssueListResponse> {
    try {
      let endpoint = API_CONFIG.ENDPOINTS.ISSUES.LIST;
      
      if (params) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
        
        if (searchParams.toString()) {
          endpoint += `?${searchParams.toString()}`;
        }
      }

      const response = await apiClient.get<IssueListResponse>(endpoint);
      return response;
    } catch (error) {
      console.error('Failed to fetch issues:', error);
      throw error;
    }
  }

  /**
   * Get current user's issues
   */
  static async getMyIssues(page: number = 1, per_page: number = 20): Promise<IssueListResponse> {
    try {
      const response = await apiClient.get<IssueListResponse>(
        `${API_CONFIG.ENDPOINTS.ISSUES.LIST}?citizen_id=me&page=${page}&per_page=${per_page}`
      );
      return response;
    } catch (error) {
      console.error('Failed to fetch user issues:', error);
      throw error;
    }
  }

  /**
   * Get issue by ID
   */
  static async getIssueById(issueId: number): Promise<IssueResponse> {
    try {
      const response = await apiClient.get<IssueResponse>(
        API_CONFIG.ENDPOINTS.ISSUES.BY_ID(issueId)
      );
      return response;
    } catch (error) {
      console.error('Failed to fetch issue:', error);
      throw error;
    }
  }

  /**
   * Map category display names
   */
  static getCategoryDisplayName(category: string): string {
    const categoryMap: Record<string, string> = {
      'potholes': 'Road Department',
      'WaterLogging': 'Public Service',
      'DamagedElectricalPoles': 'Electricity Department',
      'Garbage': 'Sanitary Department',
      'FallenTrees': 'Public Service'
    };
    return categoryMap[category] || category;
  }

  /**
   * Map status display names
   */
  static getStatusDisplayName(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'Pending Review',
      'in_progress': 'In Progress',
      'resolved': 'Resolved'
    };
    return statusMap[status] || status;
  }

  /**
   * Get status color for UI
   */
  static getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      'pending': '#FF9500',
      'in_progress': '#007AFF',
      'resolved': '#34C759'
    };
    return colorMap[status] || '#666666';
  }
}

export default IssueService;