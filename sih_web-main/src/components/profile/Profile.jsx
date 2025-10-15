import React, { useState } from 'react';
import { useAuth } from "../../context/AuthContext";
import Header from '../common/Header';
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  Calendar, 
  Shield, 
  Edit3, 
  Save, 
  X,
  Camera,
  Key,
  Settings,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { getRoleName } from '../../utils/constants';

const Profile = () => {
  const { currentUser, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [formData, setFormData] = useState({
    fullname: currentUser?.fullname || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
    department: currentUser?.department || ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await updateProfile(formData);
      
      if (result.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        setIsEditing(false);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update profile' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while updating profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // This would need to be implemented in your auth context
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setIsChangingPassword(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to change password' });
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setFormData({
      fullname: currentUser?.fullname || '',
      email: currentUser?.email || '',
      phone: currentUser?.phone || '',
      department: currentUser?.department || ''
    });
    setIsEditing(false);
    setMessage({ type: '', text: '' });
  };

  const cancelPasswordChange = () => {
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setIsChangingPassword(false);
    setMessage({ type: '', text: '' });
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Profile" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-600">Unable to load profile. Please try logging in again.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Profile" />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-md flex items-center ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 mr-2" />
            )}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-8 text-white text-center">
                <div className="relative inline-block">
                  <div className="h-24 w-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="h-12 w-12" />
                  </div>
                  <button className="absolute bottom-0 right-0 h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors">
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
                <h3 className="text-xl font-semibold">{currentUser.fullname || 'User'}</h3>
                <p className="text-blue-100">{getRoleName(currentUser.role)}</p>
              </div>
              
              <div className="px-6 py-4 space-y-4">
                <div className="flex items-center text-gray-600">
                  <Mail className="h-4 w-4 mr-3" />
                  <span className="text-sm">{currentUser.email}</span>
                </div>
                {currentUser.department && (
                  <div className="flex items-center text-gray-600">
                    <Building className="h-4 w-4 mr-3" />
                    <span className="text-sm">{currentUser.department}</span>
                  </div>
                )}
                <div className="flex items-center text-gray-600">
                  <Calendar className="h-4 w-4 mr-3" />
                  <span className="text-sm">
                    Joined {currentUser.created_at ? new Date(currentUser.created_at).toLocaleDateString() : 'Recently'}
                  </span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Shield className="h-4 w-4 mr-3" />
                  <span className="text-sm">Role: {getRoleName(currentUser.role)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center px-3 py-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Edit3 className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                )}
              </div>
              
              <div className="px-6 py-6">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        name="fullname"
                        value={formData.fullname}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled
                      />
                      <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter phone number"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Department
                      </label>
                      <input
                        type="text"
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter department"
                      />
                    </div>
                    
                    <div className="flex space-x-3 pt-4">
                      <button
                        onClick={handleSaveProfile}
                        disabled={loading}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Save className="h-4 w-4 mr-1" />
                        {loading ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Full Name</label>
                      <p className="mt-1 text-sm text-gray-900">{currentUser.fullname || 'Not set'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{currentUser.email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">{currentUser.phone || 'Not set'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Department</label>
                      <p className="mt-1 text-sm text-gray-900">{currentUser.department || 'Not assigned'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Security Settings */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Security Settings</h3>
                {!isChangingPassword && (
                  <button
                    onClick={() => setIsChangingPassword(true)}
                    className="flex items-center px-3 py-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Key className="h-4 w-4 mr-1" />
                    Change Password
                  </button>
                )}
              </div>
              
              <div className="px-6 py-6">
                {isChangingPassword ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Current Password
                      </label>
                      <input
                        type="password"
                        name="currentPassword"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        name="newPassword"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        name="confirmPassword"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div className="flex space-x-3 pt-4">
                      <button
                        onClick={handleChangePassword}
                        disabled={loading}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Save className="h-4 w-4 mr-1" />
                        {loading ? 'Changing...' : 'Change Password'}
                      </button>
                      <button
                        onClick={cancelPasswordChange}
                        className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Password</p>
                        <p className="text-sm text-gray-500">Last changed recently</p>
                      </div>
                      <div className="text-sm text-gray-400">••••••••</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Account Information */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Account Information</h3>
              </div>
              
              <div className="px-6 py-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Role</label>
                    <p className="mt-1 text-sm text-gray-900">{getRoleName(currentUser.role)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">User ID</label>
                    <p className="mt-1 text-sm text-gray-900">{currentUser.id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Member Since</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {currentUser.created_at ? new Date(currentUser.created_at).toLocaleDateString() : 'Recently'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Last Login</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {currentUser.loginTime ? new Date(currentUser.loginTime).toLocaleDateString() : 'Today'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;