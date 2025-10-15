import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';

export const useIssues = () => {
  const { currentUser } = useAuth();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch issues from backend - FIXED to use consistent API methods
  const fetchIssues = async (filters = {}) => {
    if (!currentUser) return { issues: [], pagination: null };
    
    setLoading(true);
    setError(null);
    
    try {
      // Use the standardized API method
      const data = await apiService.issues.list(filters);
      const issuesList = data.issues || data || [];
      setIssues(issuesList);
      return {
        issues: issuesList,
        pagination: data.pagination || null
      };
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch issues:', err);
      return { issues: [], pagination: null };
    } finally {
      setLoading(false);
    }
  };

  // Create new issue - FIXED
  const createIssue = async (issueData) => {
    try {
      setError(null);
      const data = await apiService.issues.create(issueData);
      await fetchIssues(); // Refresh list
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Create issue with image - FIXED
  const createIssueWithImage = async (formData) => {
    try {
      setError(null);
      const data = await apiService.issues.createWithImage(formData);
      await fetchIssues(); // Refresh list
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Update issue - FIXED
  const updateIssue = async (issueId, updateData) => {
    try {
      setError(null);
      const data = await apiService.issues.update(issueId, updateData);
      // Update local state
      setIssues(prev => prev.map(issue => 
        issue.id === parseInt(issueId) ? { ...issue, ...data } : issue
      ));
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Get single issue - FIXED
  const getIssue = async (issueId) => {
    try {
      setError(null);
      return await apiService.issues.getById(issueId);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Vote on issue - FIXED
  const voteIssue = async (issueId) => {
    try {
      setError(null);
      const data = await apiService.issues.vote(issueId);
      // Update local state to reflect vote
      setIssues(prev => prev.map(issue => 
        issue.id === parseInt(issueId) 
          ? { ...issue, votes: (issue.votes || 0) + 1, userHasVoted: true }
          : issue
      ));
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Remove vote from issue - FIXED
  const removeVote = async (issueId) => {
    try {
      setError(null);
      const data = await apiService.issues.removeVote(issueId);
      // Update local state to reflect vote removal
      setIssues(prev => prev.map(issue => 
        issue.id === parseInt(issueId) 
          ? { ...issue, votes: Math.max((issue.votes || 0) - 1, 0), userHasVoted: false }
          : issue
      ));
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Search issues - FIXED
  const searchIssues = async (searchParams) => {
    try {
      setError(null);
      setLoading(true);
      const data = await apiService.issues.search(searchParams);
      const searchResults = data.issues || data || [];
      setIssues(searchResults);
      return {
        issues: searchResults,
        pagination: data.pagination || null
      };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get issue statistics - FIXED
  const getIssueStats = async () => {
    try {
      setError(null);
      return await apiService.issues.getStats();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Upload image for issue - FIXED
  const uploadImage = async (formData) => {
    try {
      setError(null);
      return await apiService.issues.uploadImage(formData);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Get nearby issues - FIXED
  const getNearbyIssues = async (params = {}) => {
    try {
      setError(null);
      return await apiService.issues.getNearby(params);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Delete issue - FIXED
  const deleteIssue = async (issueId) => {
    try {
      setError(null);
      const data = await apiService.issues.delete(issueId);
      // Remove from local state
      setIssues(prev => prev.filter(issue => issue.id !== parseInt(issueId)));
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Filter issues by status
  const filterIssuesByStatus = (status) => {
    return issues.filter(issue => issue.status === status);
  };

  // Filter issues by department
  const filterIssuesByDepartment = (department) => {
    return issues.filter(issue => issue.department === department);
  };

  // Filter issues by priority
  const filterIssuesByPriority = (priority) => {
    return issues.filter(issue => issue.priority === priority);
  };

  // Get issues assigned to current user (for supervisors)
  const getMyAssignedIssues = () => {
    if (!currentUser) return [];
    return issues.filter(issue => 
      issue.assignedTo === currentUser.email || 
      issue.assignedTo === currentUser.id
    );
  };

  // Get issues from current user's department (for staff)
  const getDepartmentIssues = () => {
    if (!currentUser || !currentUser.department) return [];
    return issues.filter(issue => issue.department === currentUser.department);
  };

  // Initial fetch on mount
  useEffect(() => {
    if (currentUser) {
      fetchIssues();
    }
  }, [currentUser]);

  // Clear errors when user changes
  useEffect(() => {
    setError(null);
  }, [currentUser]);

  return {
    // Data
    issues,
    loading,
    error,
    
    // Core CRUD operations
    fetchIssues,
    createIssue,
    createIssueWithImage,
    updateIssue,
    deleteIssue,
    getIssue,
    
    // Interaction methods
    voteIssue,
    removeVote,
    
    // Search and statistics
    searchIssues,
    getIssueStats,
    getNearbyIssues,
    
    // File operations
    uploadImage,
    
    // Filtering utilities
    filterIssuesByStatus,
    filterIssuesByDepartment,
    filterIssuesByPriority,
    getMyAssignedIssues,
    getDepartmentIssues,
    
    // Computed values
    totalIssues: issues.length,
    openIssues: issues.filter(issue => issue.status === 'open').length,
    inProgressIssues: issues.filter(issue => issue.status === 'in_progress').length,
    resolvedIssues: issues.filter(issue => issue.status === 'resolved').length,
  };
};

export default useIssues;