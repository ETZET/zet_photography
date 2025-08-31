import { useState, useEffect, createContext, useContext } from 'react';
import { getCurrentUser, signIn, signOut, confirmSignIn } from 'aws-amplify/auth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      const result = await signIn({ username: email, password });
      
      if (result.isSignedIn) {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        return { success: true };
      } else if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        return { 
          success: false, 
          requiresNewPassword: true, 
          error: 'New password required'
        };
      }
      
      return { success: false, error: 'Login incomplete' };
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const confirmNewPassword = async (newPassword) => {
    try {
      setLoading(true);
      setError(null);
      const result = await confirmSignIn({ challengeResponse: newPassword });
      
      if (result.isSignedIn) {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        return { success: true };
      }
      
      return { success: false, error: 'Password confirmation failed' };
    } catch (error) {
      console.error('Confirm password error:', error);
      setError(error.message || 'Password confirmation failed');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    confirmNewPassword,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};