import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useIssues } from '../../hooks/useIssues';
import Sidebar from '../common/Sidebar';
import Header from '../common/Header';
import LoadingSpinner from '../common/LoadingSpinner';
import { 
  MapPin, 
  Upload, 
  Image as ImageIcon, 
  AlertCircle, 
  CheckCircle, 
  Camera,
  X,
  Plus
} from 'lucide-react';

const ISSUE_CATEGORIES = {
  roads: 'Roads & Infrastructure',
  waste: 'Waste Management',
  water: 'Water Supply',
  streetlight: 'Street Lighting',
  other: 'Other'
};

const ISSUE_PRIORITIES = {
  low: 'Low',
  medium: 'Medium',
  high: 'High'
};

const IssueCreate = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { createIssue, loading } = useIssues();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'medium',
    latitude: null,
    longitude: null,
    location_description: '',
    image_files: []
  });
  
  const [errors, setErrors] = useState({});
  const [locationLoading, setLocationLoading] = useState(false);
  const [useGPS, setUseGPS] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleLocationCapture = async () => {
    if (!navigator.geolocation) {
      setErrors(prev => ({ ...prev, location: 'Geolocation is not supported by this browser' }));
      return;
    }

    setLocationLoading(true);
    setErrors(prev => ({ ...prev, location: '' }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }));
        setUseGPS(true);
        setLocationLoading(false);
      },
      (error) => {
        let errorMessage = 'Failed to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
          default:
            errorMessage = 'Unknown location error';
        }
        setErrors(prev => ({ ...prev, location: errorMessage }));
        setLocationLoading(false);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0 
      }
    );
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
  };

  const handleFiles = (files) => {
    // Validate files
    const validFiles = files.filter(file => {
      const isValid = file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024; // 10MB limit
      return isValid;
    });

    if (validFiles.length !== files.length) {
      setErrors(prev => ({ 
        ...prev, 
        images: 'Some files were invalid. Only images under 10MB are allowed.' 
      }));
    }

    // Limit to 5 images max
    const newFiles = [...formData.image_files, ...validFiles].slice(0, 5);
    setFormData(prev => ({
      ...prev,
      image_files: newFiles
    }));
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      image_files: prev.image_files.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.trim().length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 20) {
      newErrors.description = 'Description must be at least 20 characters';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (!formData.location_description.trim() && !formData.latitude) {
      newErrors.location = 'Please provide either location description or GPS coordinates';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitLoading(true);

    try {
      // Prepare issue data
      const issueData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        priority: formData.priority,
        location_description: formData.location_description.trim(),
        ...(formData.latitude && { latitude: formData.latitude }),
        ...(formData.longitude && { longitude: formData.longitude })
      };

      // Handle image upload if there are files
      if (formData.image_files.length > 0) {
        const formDataWithImages = new FormData();
        
        // Add issue data
        Object.keys(issueData).forEach(key => {
          if (issueData[key] !== null && issueData[key] !== undefined) {
            formDataWithImages.append(key, issueData[key]);
          }
        });

        // Add image files
        formData.image_files.forEach((file, index) => {
          formDataWithImages.append(`image_${index}`, file);
        });

        await createIssue(formDataWithImages);
      } else {
        await createIssue(issueData);
      }

      // Success - redirect to issues list
      navigate('/issues', { 
        state: { message: 'Issue created successfully!' }
      });

    } catch (error) {
      console.error('Failed to create issue:', error);
      setErrors(prev => ({ 
        ...prev, 
        submit: error.message || 'Failed to create issue. Please try again.' 
      }));
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 ml-60">
          <Header title="Create Issue" />
          <main className="p-6">
            <LoadingSpinner size="large" text="Creating issue..." />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-60">
        <Header title="Create New Issue" />
        
        <main className="p-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Report a New Issue</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Issue Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Brief description of the issue..."
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.title ? 'border-red-300' : 'border-gray-300'
                    }`}
                    maxLength="200"
                  />
                  {errors.title && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.title}
                    </p>
                  )}
                </div>

                {/* Category and Priority */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.category ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select a category</option>
                      {Object.entries(ISSUE_CATEGORIES).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    {errors.category && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.category}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority
                    </label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {Object.entries(ISSUE_PRIORITIES).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Detailed Description *
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="5"
                    placeholder="Provide detailed information about the issue, including when you noticed it, any potential hazards, and other relevant details..."
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.description ? 'border-red-300' : 'border-gray-300'
                    }`}
                    maxLength="2000"
                  />
                  <div className="flex justify-between items-center mt-1">
                    {errors.description && (
                      <p className="text-sm text-red-600 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.description}
                      </p>
                    )}
                    <p className="text-sm text-gray-500">
                      {formData.description.length}/2000 characters
                    </p>
                  </div>
                </div>

                {/* Location Section */}
                <div className="border rounded-lg p-6 bg-gray-50">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Location Information</h3>
                  
                  <div className="space-y-4">
                    {/* GPS Location */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">
                          GPS Coordinates
                        </label>
                        <button
                          type="button"
                          onClick={handleLocationCapture}
                          disabled={locationLoading}
                          className="flex items-center px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          {locationLoading ? 'Getting Location...' : 'Use Current Location'}
                        </button>
                      </div>
                      
                      {useGPS && formData.latitude && (
                        <div className="flex items-center text-sm text-green-600 bg-green-50 p-3 rounded-md">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Location captured: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                        </div>
                      )}
                    </div>

                    {/* Location Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location Description {!useGPS && '*'}
                      </label>
                      <input
                        type="text"
                        name="location_description"
                        value={formData.location_description}
                        onChange={handleInputChange}
                        placeholder="e.g., Near Main Street and 2nd Avenue, opposite City Hall"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        maxLength="500"
                      />
                    </div>

                    {errors.location && (
                      <p className="text-sm text-red-600 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.location}
                      </p>
                    )}
                  </div>
                </div>

                {/* Image Upload Section */}
                <div className="border rounded-lg p-6 bg-gray-50">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Add Photos (Optional)</h3>
                  
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <div className="space-y-2">
                      <p className="text-lg text-gray-600">
                        Drag and drop images here, or{' '}
                        <label className="text-blue-600 hover:text-blue-700 cursor-pointer">
                          browse files
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                        </label>
                      </p>
                      <p className="text-sm text-gray-500">
                        Maximum 5 images, up to 10MB each
                      </p>
                    </div>
                  </div>

                  {errors.images && (
                    <p className="mt-2 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.images}
                    </p>
                  )}

                  {/* Image Preview */}
                  {formData.image_files.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Selected Images ({formData.image_files.length}/5)
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {formData.image_files.map((file, index) => (
                          <div key={index} className="relative group">
                            <div className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={`Upload ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Error */}
                {errors.submit && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600 flex items-center">
                      <AlertCircle className="h-5 w-5 mr-2" />
                      {errors.submit}
                    </p>
                  </div>
                )}

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-4 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => navigate('/issues')}
                    className="px-6 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    {submitLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-5 w-5 mr-2" />
                        Create Issue
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default IssueCreate;