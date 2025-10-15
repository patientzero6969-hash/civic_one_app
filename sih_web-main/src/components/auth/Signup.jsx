import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";
import { Eye, EyeOff, AlertCircle, CheckCircle, UserCheck } from 'lucide-react';

const Signup = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();
  
  const [formData, setFormData] = useState({
    fullname: '',
    email: '',
    password: '',
    phone: '',
    role: '', // Added role field
    department: '' // Add this line
  });

  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: []
  });

  // Role options
  const roleOptions = [
    { value: 'Admin', label: 'Administrator', description: 'Full system access' },
    { value: 'DepartmentStaff', label: 'Department Staff', description: 'Manage department issues' },
    { value: 'FieldSupervisor', label: 'Field Supervisor', description: 'Supervise field operations' }
  ];

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

    // Check password strength
    if (name === 'password') {
      setPasswordStrength(validatePassword(value));
    }

    // Clear error message when user starts typing
    if (message && message.includes('failed')) {
      setMessage('');
    }
  };

  const validatePassword = (password) => {
    const feedback = [];
    let score = 0;

    if (password.length >= 8) score++;
    else feedback.push('At least 8 characters');

    if (/[A-Z]/.test(password)) score++;
    else feedback.push('One uppercase letter');

    if (/[a-z]/.test(password)) score++;
    else feedback.push('One lowercase letter');

    if (/\d/.test(password)) score++;
    else feedback.push('One number');

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
    else feedback.push('One special character');

    return { score, feedback };
  };

  const getPasswordStrengthColor = (score) => {
    if (score <= 2) return 'bg-red-500';
    if (score <= 3) return 'bg-yellow-500';
    if (score <= 4) return 'bg-green-400';
    return 'bg-green-600';
  };

  const getPasswordStrengthText = (score) => {
    if (score <= 2) return 'Weak';
    if (score <= 3) return 'Fair';
    if (score <= 4) return 'Good';
    return 'Strong';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    // Enhanced Validation
    const requiredFields = ['fullname', 'email', 'password', 'role'];
    
    // Add department as required for staff and supervisor
    if (formData.role === 'DepartmentStaff' || formData.role === 'FieldSupervisor') {
      requiredFields.push('department');
    }
    
    const missingFields = requiredFields.filter(field => !formData[field]?.trim());
    
    if (missingFields.length > 0) {
      setMessage('Please fill in all required fields including role and department selection');
      setIsLoading(false);
      return;
    }

    if (passwordStrength.score < 3) {
      setMessage('Password is too weak. Please create a stronger password.');
      setIsLoading(false);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setMessage('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    try {
      const result = await signup(formData);
      
      if (result.success) {
        setMessage('Registration successful! Please check your email to confirm your account.');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setMessage(result.error || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Signup error:', error);
      setMessage('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Updated canSubmit logic to include department validation
  const canSubmit = () => {
    const basicRequirements = formData.fullname.trim() && 
                             formData.email.trim() && 
                             formData.password && 
                             formData.role && 
                             passwordStrength.score >= 3 && 
                             !isLoading;
    
    // Additional check for department requirement
    if (formData.role === 'DepartmentStaff' || formData.role === 'FieldSupervisor') {
      return basicRequirements && formData.department.trim();
    }
    
    return basicRequirements;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <UserCheck className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
            <p className="text-gray-600 mt-2">Join CivicConnect platform</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name */}
            <div>
              <label htmlFor="fullname" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                id="fullname"
                name="fullname"
                type="text"
                required
                value={formData.fullname}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                placeholder="Enter your full name"
                disabled={isLoading}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                placeholder="Enter your email address"
                disabled={isLoading}
              />
            </div>

            {/* Phone (Optional) */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                placeholder="Enter your phone number (optional)"
                disabled={isLoading}
              />
            </div>

            {/* Role Selection */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                Select Role *
              </label>
              <select
                id="role"
                name="role"
                required
                value={formData.role}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors bg-white"
                disabled={isLoading}
              >
                <option value="" disabled>Choose your role</option>
                {roleOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              
              {/* Role Description */}
              {formData.role && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>{roleOptions.find(r => r.value === formData.role)?.label}:</strong>{' '}
                    {roleOptions.find(r => r.value === formData.role)?.description}
                  </p>
                </div>
              )}
            </div>
            
            {/* Department Selection - Only for Staff and Supervisor */}
            {(formData.role === 'DepartmentStaff' || formData.role === 'FieldSupervisor') && (
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Department *
                </label>
                <select
                  id="department"
                  name="department"
                  required
                  value={formData.department}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors bg-white"
                  disabled={isLoading}
                >
                  <option value="" disabled>Choose your department</option>
                  <option value="Road Department">Road Department</option>
                  <option value="Electricity Department">Electricity Department</option>
                  <option value="Sanitary Department">Sanitary Department</option>
                  <option value="Public Service">Public Service</option>
                </select>
                
                {/* Department Description */}
                {formData.department && (
                  <div className="mt-2 p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-700">
                      <strong>{formData.department}</strong> - You'll see issues related to: {
                      formData.department === 'Road Department' ? 'Roads & Infrastructure' :
                      formData.department === 'Electricity Department' ? 'Street Lighting & Electrical' :
                      formData.department === 'Sanitary Department' ? 'Waste Management & Water Issues' :
                      formData.department === 'Public Service' ? 'All Categories' :
                      'All Categories'
                    }
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors pr-12"
                  placeholder="Create a strong password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">Password strength:</span>
                    <span className={`text-xs font-medium ${
                      passwordStrength.score <= 2 ? 'text-red-600' :
                      passwordStrength.score <= 3 ? 'text-yellow-600' :
                      passwordStrength.score <= 4 ? 'text-green-500' : 'text-green-600'
                    }`}>
                      {getPasswordStrengthText(passwordStrength.score)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor(passwordStrength.score)}`}
                      style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                    ></div>
                  </div>
                  {passwordStrength.feedback.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-600 mb-1">Password needs:</p>
                      <ul className="text-xs text-red-600 space-y-1">
                        {passwordStrength.feedback.map((item, index) => (
                          <li key={index} className="flex items-center">
                            <span className="w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!canSubmit()}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Message Display */}
          {message && (
            <div className={`mt-4 p-3 rounded-lg text-center font-medium flex items-center ${
              message.includes('successful') 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {message.includes('successful') ? (
                <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
              )}
              <span>{message}</span>
            </div>
          )}

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium">
                Sign In
              </Link>
            </p>
          </div>

          {/* Help Text */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              By creating an account, you agree to our terms of service and privacy policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;