import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from "../../context/AuthContext";
import Header from '../common/Header';
import { PageLoader, ErrorState } from '../common/LoadingSpinner';
import { 
  MapPin, 
  CheckCircle, 
  Clock, 
  Play, 
  AlertTriangle, 
  Camera, 
  X, 
  Send, 
  RefreshCw,
  FileText,
  User,
  Building,
  Calendar
} from 'lucide-react';
import apiService from '../../services/api';

const SupervisorDashboard = () => {
  const { currentUser } = useAuth();
  const [assignedIssues, setAssignedIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0
  });
  
  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const [currentIssueId, setCurrentIssueId] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (currentUser) {
      fetchAssignments();
    }
  }, [currentUser]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get assignments - using the correct API method
      const response = await apiService.assignments.list({
        assigned_to: currentUser.id // Filter by current user
      });
      
      if (response && (response.assignments || response.data)) {
        const assignments = response.assignments || response.data || [];
        
        // Transform assignments to include issue details
        const assignmentsWithDetails = await Promise.all(
          assignments.map(async (assignment) => {
            try {
              const issueResponse = await apiService.issues.getById(assignment.issue_id);
              return {
                id: assignment.id,
                issue_id: assignment.issue_id,
                title: assignment.issue_title || issueResponse.title || `Issue #${assignment.issue_id}`,
                description: issueResponse.description || 'No description available',
                status: assignment.status || 'pending',
                location: formatLocation(issueResponse),
                assigned_at: assignment.assigned_at,
                notes: assignment.notes,
                category: issueResponse.category || 'General',
                latitude: issueResponse.latitude,
                longitude: issueResponse.longitude,
                photos: issueResponse.image_url ? [issueResponse.image_url] : []
              };
            } catch (err) {
              console.error(`Error fetching issue ${assignment.issue_id}:`, err);
              return {
                id: assignment.id,
                issue_id: assignment.issue_id,
                title: assignment.issue_title || `Issue #${assignment.issue_id}`,
                description: 'Could not load issue details',
                status: assignment.status || 'pending',
                location: 'Location unavailable',
                assigned_at: assignment.assigned_at,
                notes: assignment.notes,
                category: 'General',
                photos: []
              };
            }
          })
        );
        
        setAssignedIssues(assignmentsWithDetails);
        
        // Calculate stats
        const statsCalc = {
          total: assignmentsWithDetails.length,
          pending: assignmentsWithDetails.filter(a => a.status === 'pending').length,
          inProgress: assignmentsWithDetails.filter(a => a.status === 'in_progress').length,
          completed: assignmentsWithDetails.filter(a => a.status === 'completed').length
        };
        setStats(statsCalc);
        
      } else {
        setAssignedIssues([]);
      }
    } catch (err) {
      console.error('Error loading assignments:', err);
      setError(err.message || 'Failed to load assignments');
      setAssignedIssues([]);
    } finally {
      setLoading(false);
    }
  };

  const formatLocation = (issue) => {
    if (issue.location && issue.location.trim()) {
      return issue.location;
    }
    if (issue.latitude && issue.longitude) {
      return `${issue.latitude.toFixed(4)}, ${issue.longitude.toFixed(4)}`;
    }
    return 'Location not specified';
  };

  const handleStatusUpdate = async (assignmentId, newStatus) => {
    try {
      setActionLoading(assignmentId);
      
      const response = await apiService.assignments.update(assignmentId, {
        status: newStatus
      });
      
      if (response) {
        // Update local state
        setAssignedIssues(prev => prev.map(issue => 
          issue.id === assignmentId 
            ? { ...issue, status: newStatus }
            : issue
        ));
        
        // Recalculate stats
        const updatedIssues = assignedIssues.map(issue => 
          issue.id === assignmentId 
            ? { ...issue, status: newStatus }
            : issue
        );
        
        const newStats = {
          total: updatedIssues.length,
          pending: updatedIssues.filter(a => a.status === 'pending').length,
          inProgress: updatedIssues.filter(a => a.status === 'in_progress').length,
          completed: updatedIssues.filter(a => a.status === 'completed').length
        };
        setStats(newStats);
        
        alert(`Status updated to ${newStatus}!`);
      }
    } catch (err) {
      console.error('Status update error:', err);
      alert('Failed to update status: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddUpdate = async (issueId, assignmentId) => {
    const updateText = prompt('Enter your progress update:');
    if (updateText && updateText.trim()) {
      try {
        setActionLoading(assignmentId);
        
        const response = await apiService.updates.create({
          issue_id: issueId,
          update_text: updateText.trim(),
          status: 'progress',
          added_by: currentUser.id
        });
        
        if (response) {
          alert('Update added successfully!');
        }
      } catch (err) {
        console.error('Update error:', err);
        alert('Failed to add update: ' + err.message);
      } finally {
        setActionLoading(null);
      }
    }
  };

  const startCamera = async (issueId) => {
    try {
      setCurrentIssueId(issueId);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera on mobile
      });
      setStream(mediaStream);
      setShowCamera(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      alert('Could not access camera. Please check permissions.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(photoDataUrl);
    }
  };

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
    setCapturedPhoto(null);
    setCurrentIssueId(null);
  };

  const submitPhoto = async () => {
    if (!capturedPhoto || !currentIssueId) return;
    
    try {
      setActionLoading(currentIssueId);
      
      // Convert base64 to blob
      const response = await fetch(capturedPhoto);
      const blob = await response.blob();
      
      // Create form data
      const formData = new FormData();
      formData.append('file', blob, 'update_photo.jpg');
      formData.append('issue_id', currentIssueId);
      
      // Upload photo
      const uploadResponse = await apiService.files.uploadImage(formData);
      
      if (uploadResponse && uploadResponse.file_url) {
        // Add update with photo
        await apiService.updates.create({
          issue_id: currentIssueId,
          update_text: 'Photo update from field supervisor',
          status: 'progress',
          photo_url: uploadResponse.file_url,
          added_by: currentUser.id
        });
        
        alert('Photo update submitted successfully!');
        closeCamera();
      }
    } catch (err) {
      console.error('Photo submission error:', err);
      alert('Failed to submit photo: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return Clock;
      case 'in_progress':
        return Play;
      case 'completed':
        return CheckCircle;
      default:
        return AlertTriangle;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Supervisor Dashboard" />
        <PageLoader text="Loading your assignments..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Supervisor Dashboard" />
        <ErrorState
          title="Failed to load dashboard"
          message={error}
          onRetry={fetchAssignments}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Supervisor Dashboard" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {currentUser?.fullname || 'Supervisor'}!
              </h1>
              <p className="text-gray-600 mt-1">
                {currentUser?.department || 'Field'} Supervisor Dashboard
              </p>
            </div>
            <button
              onClick={fetchAssignments}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Assignments</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Play className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Assignments List */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Your Assignments</h2>
          </div>
          
          <div className="p-6">
            {assignedIssues.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">No assignments found</p>
                <p className="text-sm text-gray-500 mt-2">
                  You don't have any active assignments at the moment
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {assignedIssues.map((issue) => {
                  const StatusIcon = getStatusIcon(issue.status);
                  
                  return (
                    <div 
                      key={issue.id}
                      className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <StatusIcon className="h-5 w-5 text-gray-500 mr-2" />
                            <h3 className="text-lg font-medium text-gray-900">
                              {issue.title}
                            </h3>
                            <span className={`ml-3 px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(issue.status)}`}>
                              {issue.status.replace('_', ' ')}
                            </span>
                          </div>
                          
                          <p className="text-gray-600 mb-3">{issue.description}</p>
                          
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center">
                              <MapPin className="h-4 w-4 mr-1" />
                              {issue.location}
                            </div>
                            <div className="flex items-center">
                              <Building className="h-4 w-4 mr-1" />
                              {issue.category}
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              Assigned {new Date(issue.assigned_at).toLocaleDateString()}
                            </div>
                          </div>
                          
                          {issue.notes && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                              <p className="text-sm text-gray-700">
                                <strong>Notes:</strong> {issue.notes}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div className="ml-6 flex flex-col space-y-2">
                          {issue.status === 'pending' && (
                            <button
                              onClick={() => handleStatusUpdate(issue.id, 'in_progress')}
                              disabled={actionLoading === issue.id}
                              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Start Work
                            </button>
                          )}
                          
                          {issue.status === 'in_progress' && (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(issue.id, 'completed')}
                                disabled={actionLoading === issue.id}
                                className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Complete
                              </button>
                              
                              <button
                                onClick={() => startCamera(issue.issue_id)}
                                disabled={actionLoading === issue.id}
                                className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm disabled:opacity-50"
                              >
                                <Camera className="h-4 w-4 mr-1" />
                                Add Photo
                              </button>
                            </>
                          )}
                          
                          <button
                            onClick={() => handleAddUpdate(issue.issue_id, issue.id)}
                            disabled={actionLoading === issue.id}
                            className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm disabled:opacity-50"
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Add Update
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Take Photo Update</h3>
              <button onClick={closeCamera} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {!capturedPhoto ? (
              <div>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full rounded-lg mb-4"
                />
                <button
                  onClick={capturePhoto}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Capture Photo
                </button>
              </div>
            ) : (
              <div>
                <img 
                  src={capturedPhoto} 
                  alt="Captured" 
                  className="w-full rounded-lg mb-4"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCapturedPhoto(null)}
                    className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Retake
                  </button>
                  <button
                    onClick={submitPhoto}
                    disabled={actionLoading === currentIssueId}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    Submit
                  </button>
                </div>
              </div>
            )}
            
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorDashboard;