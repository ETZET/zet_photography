import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';

const LoginPage = ({ onBack }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Add your login logic here
    try {
      console.log('Login attempt:', formData);
      // Replace with actual authentication logic
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
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
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-2xl font-light mb-4">Welcome Back</h1>
          <p className="text-gray-600 text-sm">Sign in to access your account</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gray-900 text-white font-light hover:bg-gray-800 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
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
      </div>
    </div>
  );
};

export default LoginPage;