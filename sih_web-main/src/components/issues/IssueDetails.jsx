import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";
import Header from '../common/Header';
import { 
  MapPin, 
  Calendar, 
  User, 
  Building, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Image as ImageIcon,
  UserPlus,
  RefreshCw,
  TrendingUp,
  ArrowLeft,
  ThumbsUp,
  MessageSquare
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.103:8000';

const IssueDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, token } = useAuth();
  const [issue, setIssue] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id && token) {
      fetchIssueDetails();
      fetchAssignments();
      fetchUpdates();
    }
  }, [id, token]);

  const apiRequest = async (url, options = {}) => {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(`${API_BASE_URL}${url}`, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  };

  const fetchIssueDetails = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/issues/${id}`);
      setIssue(data);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch issue details:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      const data = await apiRequest(`/api/assignments/?issue_id=${id}`);
      setAssignments(data.assignments || []);
    } catch (err) {
      console.error('Failed to fetch assignments:', err);
    }
  };

  const fetchUpdates = async () => {
    try {
      const data = await apiRequest(`/api/updates/issue/${id}`);
      setUpdates(data.updates || []);
    } catch (err) {
      console.error('Failed to fetch updates:', err);
    }
  };

  const handleAssignTask = async () => {
    if (!canManageIssue()) {
      alert('You do not have permission to assign this task.');
      return;
    }

    const staffId = prompt('Enter Staff ID or Email to assign:');
    if (staffId && staffId.trim()) {
      try {
        await apiRequest('/api/assignments/', {
          method: 'POST',
          body: JSON.stringify({
            issue_id: parseInt(id),
            staff_id: staffId.trim(),
            notes: 'Assigned from issue details'
          }),
        });
        
        alert('Task assigned successfully!');
        fetchAssignments(); // Refresh assignments
      } catch (err) {
        alert('Failed to assign task: ' + err.message);
      }
    }
  };

  const handleUpdateStatus = async () => {
    if (!canUpdateStatus()) {
      alert('You do not have permission to update this status.');
      return;
    }

    const statusOptions = ['pending', 'in_progress', 'resolved'];
    const currentStatus = issue.status;
    const newStatus = prompt(`Current status: ${currentStatus}\nEnter new status (${statusOptions.join('/')}):`);
    
    if (newStatus && statusOptions.includes(newStatus)) {
      try {
        const updatedIssue = await apiRequest(`/api/issues/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus }),
        });
        
        setIssue(updatedIssue);
        alert('Status updated successfully!');
      } catch (err) {
        alert('Failed to update status: ' + err.message);
      }
    }
  };

  const handleVote = async () => {
    if (currentUser.role !== 'citizen') {
      alert('Only citizens can vote on issues.');
      return;
    }

    try {
      if (issue.user_has_voted) {
        await apiRequest(`/api/issues/${id}/vote`, { method: 'DELETE' });
      } else {
        await apiRequest(`/api/issues/${id}/vote`, { method: 'POST' });
      }
      
      // Refresh issue data to get updated vote count
      fetchIssueDetails();
    } catch (err) {
      alert('Failed to update vote: ' + err.message);
    }
  };

  const handleAddUpdate = async () => {
    if (!canAddUpdate()) {
      alert('You do not have permission to add updates.');
      return;
    }

    const updateText = prompt('Enter update message:');
    if (updateText && updateText.trim()) {
      try {
        await apiRequest('/api/updates/', {
          method: 'POST',
          body: JSON.stringify({
            issue_id: parseInt(id),
            update_text: updateText.trim()
          }),
        });
        
        alert('Update added successfully!');
        fetchUpdates(); // Refresh updates
      } catch (err) {
        alert('Failed to add update: ' + err.message);
      }
    }
  };

  const canManageIssue = () => {
    return currentUser?.role === 'admin' || currentUser?.role === 'supervisor';
  };

  const canUpdateStatus = () => {
    return currentUser?.role === 'admin' || 
           currentUser?.role === 'supervisor' ||
           currentUser?.role === 'staff';
  };

  const canAddUpdate = () => {
    return currentUser?.role === 'admin' || 
           currentUser?.role === 'supervisor' ||
           currentUser?.role === 'staff';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Issue Details" />
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Issue Details" />
        <div className="p-6">
          <div className="bg-white rounded-lg p-8 text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              {error ? 'Error Loading Issue' : 'Issue not found'}
            </h2>
            <p className="text-gray-600 mb-8">
              {error || "The issue you're looking for doesn't exist or you don't have permission to view it."}
            </p>
            <button
              onClick={() => navigate('/issues')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Issues
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Issue Details" />
      
      <main className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => navigate('/issues')}
            className="mb-6 flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Issues
          </button>

          {/* Issue Header */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {issue.title}
                </h1>
                <div className="flex items-center space-x-4">
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(issue.status)}`}>
                    {issue.status}
                  </span>
                  <span className={`text-sm font-medium ${getPriorityColor(issue.priority)}`}>
                    Priority: {issue.priority || 'medium'}
                  </span>
                  {issue.days_open > 0 && (
                    <span className="text-sm text-gray-500">
                      Open for {issue.days_open} days
                    </span>
                  )}
                </div>
              </div>
              
              {/* Vote Section */}
              {currentUser?.role === 'citizen' && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleVote}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-lg ${
                      issue.user_has_voted 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    <span>{issue.upvotes || 0}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Issue Meta Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <div className="flex items-center">
                <span className="font-semibold text-gray-700 mr-2">ID:</span>
                <span className="text-gray-900">#{issue.id}</span>
              </div>
              
              <div className="flex items-center">
                <span className="font-semibold text-gray-700 mr-2">Category:</span>
                <span className="text-gray-900">{issue.category || 'N/A'}</span>
              </div>
              
              <div className="flex items-center">
                <User className="h-4 w-4 text-gray-500 mr-2" />
                <span className="font-semibold text-gray-700 mr-2">Reporter:</span>
                <span className="text-gray-900">{issue.citizen_name || 'Unknown'}</span>
              </div>
              
              {issue.location_description && (
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="font-semibold text-gray-700 mr-2">Location:</span>
                  <span className="text-gray-900">{issue.location_description}</span>
                </div>
              )}
              
              <div className="flex items-center">
                <Calendar className="h-4 w-4 text-gray-500 mr-2" />
                <span className="font-semibold text-gray-700 mr-2">Created:</span>
                <span className="text-gray-900">{formatDate(issue.created_at)}</span>
              </div>
              
              {issue.updated_at && issue.updated_at !== issue.created_at && (
                <div className="flex items-center">
                  <Clock className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="font-semibold text-gray-700 mr-2">Updated:</span>
                  <span className="text-gray-900">{formatDate(issue.updated_at)}</span>
                </div>
              )}
            </div>

            {/* Issue Description */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700 leading-relaxed">{issue.description}</p>
              </div>
            </div>

            {/* Issue Image */}
            {issue.image_urls && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <ImageIcon className="h-5 w-5 mr-2" />
                  Issue Photo
                </h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <img 
                    src={issue.image_urls} 
                    alt="Issue Photo" 
                    className="max-w-full h-auto rounded-lg shadow-sm"
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
              {canManageIssue() && (
                <button
                  onClick={handleAssignTask}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign Task
                </button>
              )}
              
              {canUpdateStatus() && (
                <button
                  onClick={handleUpdateStatus}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors inline-flex items-center"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Update Status
                </button>
              )}
              
              {canAddUpdate() && (
                <button
                  onClick={handleAddUpdate}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Add Update
                </button>
              )}
            </div>
          </div>

          {/* Map Section */}
          {issue.latitude && issue.longitude && (
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                Issue Location
              </h3>
              <div className="bg-gray-200 rounded-lg h-80 flex items-center justify-center text-gray-600 font-medium">
                [Interactive Map - Lat: {issue.latitude}, Lng: {issue.longitude}]
              </div>
            </div>
          )}

          {/* Assignments Section */}
          {assignments.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <UserPlus className="h-5 w-5 mr-2" />
                Assignments
              </h3>
              <div className="space-y-3">
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">
                        {assignment.staff_name || 'Unknown Staff'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Assigned: {formatDate(assignment.assigned_at)}
                      </p>
                      {assignment.notes && (
                        <p className="text-sm text-gray-600 mt-1">{assignment.notes}</p>
                      )}
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(assignment.status)}`}>
                      {assignment.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Updates Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <MessageSquare className="h-5 w-5 mr-2" />
              Issue Updates
            </h3>
            
            {updates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No updates available for this issue.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {updates.map((update) => (
                  <div key={update.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="font-medium text-gray-900">
                          {update.staff_name || 'Unknown Staff'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {formatDate(update.created_at)}
                      </span>
                    </div>
                    <p className="text-gray-700">{update.update_text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default IssueDetails;