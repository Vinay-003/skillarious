'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import authService from '@/services/auth.service';

interface User {
  email: string;
  id: string;
  isEducator: boolean;
  isAdmin: boolean;
  name: string;
  pfp: string;
  phone: string;
  role: string;
  verified: boolean;
}

interface SignupData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  gender?: string;
  age?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<any>;
  logout: () => Promise<void>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUserProfile = async () => {
    try {
      const response = await authService.validateSession();
      if (response.success) {
        setUser(response.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      setUser(null);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const accessToken = authService.getAccessToken();
        console.log('Access token exists:', !!accessToken);
        
        const refreshToken = authService.getRefreshToken();
        console.log('Refresh token exists:', !!refreshToken);

        if (!accessToken && !refreshToken) {
          console.log('No tokens found, setting user to null');
          setUser(null);
          return;
        }

        if (!accessToken && refreshToken) {
          console.log('Attempting to refresh token...');
          try {
            await authService.refreshToken();
            console.log('Token refresh successful');
          } catch (error) {
            console.error('Token refresh failed:', error);
            setUser(null);
            return;
          }
        }

        await fetchUserProfile();
      } catch (error) {
        console.error('Auth initialization failed:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);
      if (response.success) {
        await fetchUserProfile(); // Fetch user profile after successful login
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const signup = async (data: SignupData) => {
    try {
      const response = await authService.signup(data);
      return response;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to create account');
    }
  };

  const verifyOtp = async (email: string, otp: string) => {
    try {
      const response = await authService.verifyOtp(email, otp);
      if (response.success) {
        // Save the tokens received from OTP verification
        if (response.accessToken && response.refreshToken) {
          authService.setTokens({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            success: true,
            message: response.message
          });
        }

        // Check if user wanted to register as educator
        const pendingEducatorRegistration = localStorage.getItem('pendingEducatorRegistration');
        
        if (pendingEducatorRegistration) {
          localStorage.removeItem('pendingEducatorRegistration');
          router.push('/educator/register');
        } else {
          router.push('/login');
        }
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'OTP verification failed');
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error: any) {
      console.error('Logout failed:', error);
    } finally {
      // Clear user state
      setUser(null);
      
      // Clear any context-specific state
      setLoading(false);
      
      // You might want to clear other app-specific state here
    }
  };
  const forgotPassword = async (email: string) => {
    try {
      const response = await authService.forgotPassword(email);
      return {
        success: true,
        message: response.data.message
      };
    } catch (error: any) {
      console.error('Forgot password error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to send reset code'
      };
    }
  };
  const resetPassword = async (email: string, otp: string, newPassword: string) => {
    try {
      const response = await authService.resetPassword(email, otp, newPassword);
      return response;
    } catch (error: any) {
      console.error('Reset password error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to reset password'
      };
    }
  };
  const refreshUser = async () => {
    try {
      await fetchUserProfile();
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to refresh user');
    }
  };
  

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      signup, 
      logout, 
      verifyOtp,
      forgotPassword,
      resetPassword,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);












