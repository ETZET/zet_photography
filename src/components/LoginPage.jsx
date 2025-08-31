import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';

const LoginPage = ({ onBack, onLoginSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [requiresNewPassword, setRequiresNewPassword] = useState(false);
  const { login, confirmNewPassword, loading, error, isAuthenticated, user } = useAuth();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (requiresNewPassword) {
      // Handle new password confirmation
      if (formData.newPassword !== formData.confirmPassword) {
        alert('Passwords do not match');
        return;
      }
      
      const result = await confirmNewPassword(formData.newPassword);
      if (result.success) {
        onLoginSuccess();
      }
    } else {
      // Handle initial login
      const result = await login(formData.email, formData.password);
      if (result.success) {
        onLoginSuccess();
      } else if (result.requiresNewPassword) {
        setRequiresNewPassword(true);
      }
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col relative">
      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-6 left-6 p-2 text-gray-400 hover:text-gray-600 transition-colors duration-300"
        aria-label="Back to about"
      >
        <ArrowLeft size={20} />
      </button>

      <div className="flex flex-col justify-center max-w-md mx-auto px-6 py-12 flex-1">
        {isAuthenticated ? (
          /* Welcome Message for Authenticated User */
          <div className="text-center">
            <h1 className="text-2xl font-light mb-6">Welcome, Admin</h1>
            <p className="text-gray-600 mb-8">
              You are successfully logged in to your photography portfolio.
            </p>
            <button
              onClick={() => onLoginSuccess()}
              className="w-full py-3 bg-gray-900 text-white font-light hover:bg-gray-800 transition-colors duration-300"
            >
              Continue to Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-12 text-center">
              <h1 className="text-2xl font-light mb-4">
                {requiresNewPassword ? 'Set New Password' : 'Welcome Back'}
              </h1>
              <p className="text-gray-600 text-sm">
                {requiresNewPassword 
                  ? 'Please set a new password for your account' 
                  : 'Sign in to access your account'
                }
              </p>
            </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {!requiresNewPassword ? (
            <>
              {/* Email Input */}
              <div>
                <label htmlFor="email" className="block text-sm font-light text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-3 border border-gray-200 focus:border-gray-400 focus:outline-none transition-colors duration-300 bg-white"
                  placeholder="Enter your email"
                />
              </div>

              {/* Password Input */}
              <div>
                <label htmlFor="password" className="block text-sm font-light text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-3 pr-12 border border-gray-200 focus:border-gray-400 focus:outline-none transition-colors duration-300 bg-white"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* New Password Input */}
              <div>
                <label htmlFor="newPassword" className="block text-sm font-light text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    id="newPassword"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-3 pr-12 border border-gray-200 focus:border-gray-400 focus:outline-none transition-colors duration-300 bg-white"
                    placeholder="Enter your new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-light text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-3 border border-gray-200 focus:border-gray-400 focus:outline-none transition-colors duration-300 bg-white"
                  placeholder="Confirm your new password"
                />
              </div>
            </>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gray-900 text-white font-light hover:bg-gray-800 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
{loading 
              ? (requiresNewPassword ? 'Setting Password...' : 'Signing in...') 
              : (requiresNewPassword ? 'Set New Password' : 'Sign In')
            }
          </button>
        </form>

            {/* Additional Options */}
            <div className="mt-8 text-center">
              <button className="text-sm text-gray-600 hover:text-gray-800 transition-colors">
                Forgot your password?
              </button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <button className="text-gray-900 hover:underline transition-all">
                  Sign up
                </button>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginPage;