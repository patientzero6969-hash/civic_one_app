import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';
import { ROLES, getDashboardRoute } from '../../utils/constants';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'Admin', // Frontend display format
    department: '' // Add this line
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  // Get the intended destination after login
  const from = location.state?.from?.pathname || null;

  const handleInputChange = (e) => {
  const { name, value } = e.target;
  setFormData(prev => ({
    ...prev,
    [name]: value
  }));

  // Clear department when role changes to Admin
  if (name === 'role' && value === 'Admin') {
    setFormData(prev => ({
      ...prev,
      [name]: value,
      department: ''
    }));
  }
  
  // Clear field-specific error when user starts typing
  if (errors[name]) {
    setErrors(prev => ({
      ...prev,
      [name]: ''
    }));
  }
};

  const validateForm = () => {
    const newErrors = {};

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    // Role validation
    if (!formData.role) {
      newErrors.role = 'Please select your role';
    }

    // Department validation (only for staff and supervisor)
    if ((formData.role === 'DepartmentStaff' || formData.role === 'FieldSupervisor') && !formData.department) {
      newErrors.department = 'Please select your department';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitMessage('');
    setErrors({});

    try {
      const result = await login(formData.email, formData.password, formData.role, formData.department);
      
      if (result.success) {
        setSubmitMessage('Login successful! Redirecting...');
        
        // Determine where to redirect
        let redirectPath;
        
        if (from) {
          // User was trying to access a specific page
          redirectPath = from;
        } else {
          // Default dashboard based on role
          redirectPath = getDashboardRoute(result.user.role);
        }
        
        // Small delay to show success message
        setTimeout(() => {
          navigate(redirectPath, { replace: true });
        }, 1000);
        
      } else {
        setErrors({ submit: result.error });
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ submit: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Civic Connect
          </h1>
          <h2 className="text-xl text-gray-600">
            Sign in to your account
          </h2>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Role Selection */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Login as
              </label>
              <div className="mt-1 relative">
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className={`appearance-none block w-full px-3 py-2 pl-10 border ${
                    errors.role ? 'border-red-300' : 'border-gray-300'
                  } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                  required
                >
                  <option value="Admin">Administrator</option>
                  <option value="DepartmentStaff">Department Staff</option>
                  <option value="FieldSupervisor">Field Supervisor</option>
                </select>
                <User className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
              </div>
              {errors.role && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.role}
                </p>
              )}
            </div>

            {/* Department Selection - Only for Staff and Supervisor */}
            {(formData.role === 'DepartmentStaff' || formData.role === 'FieldSupervisor') && (
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                  Department
                </label>
                <div className="mt-1 relative">
                  <select
                    id="department"
                    name="department"
                    value={formData.department || ''}
                    onChange={handleInputChange}
                    className={`appearance-none block w-full px-3 py-2 pl-10 border ${
                      errors.department ? 'border-red-300' : 'border-gray-300'
                    } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                    required
                  >
                    <option value="">Select your department</option>
                    <option value="Road Department">Road Department</option>
                    <option value="Electricity Department">Electricity Department</option>
                    <option value="Sanitary Department">Sanitary Department</option>
                    <option value="Public Service">Public Service</option>
                  </select>
                  <User className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
                </div>
                {errors.department && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.department}
                  </p>
                )}
              </div>
            )}
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1 relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`appearance-none block w-full px-3 py-2 pl-10 border ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                  placeholder="Enter your email"
                  required
                />
                <Mail className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`appearance-none block w-full px-3 py-2 pl-10 pr-10 border ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                  placeholder="Enter your password"
                  required
                />
                <Lock className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
                <button
                  type="button"
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.password}
                </p>
              )}
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Login Failed
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      {errors.submit}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message */}
            {submitMessage && (
              <div className="rounded-md bg-green-50 p-4">
                <div className="flex">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-800">
                      {submitMessage}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                  isSubmitting || isLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                }`}
              >
                {isSubmitting || isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign in'
                )}
              </button>
            </div>

            {/* Sign up link */}
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Sign up here
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Demo credentials helper */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-gray-50 py-4 px-4 sm:rounded-lg sm:px-6">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Demo Credentials</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <p><strong>Admin:</strong> Adminstrator / admin4@gmail.com.com / Admin4@123</p>
            <p><strong>Staff:</strong> Department staff / Road Department / staff1@gmail.com / Staff1@123</p>
            <p><strong>Supervisor:</strong> Supervisor / Road Department / sup1@gmail.com / Sup1@123</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;