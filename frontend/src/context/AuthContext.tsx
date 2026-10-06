'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }> ;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
}

export class VerificationSessionError extends Error {
  constructor() {
    super('Your email was verified, but we could not finish signing you in. Please sign in to continue.');
    this.name = 'VerificationSessionError';
  }
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionGeneration = useRef(0);
  const router = useRouter();

  const fetchUserProfile = async () => {
    const generation = sessionGeneration.current;
    try {
      const response = await authService.validateSession();
      if (generation !== sessionGeneration.current) return false;
      if (response.success && response.user) {
        setUser(response.user);
        return true;
      } else {
        setUser(null);
        return false;
      }
    } catch {
      if (generation === sessionGeneration.current) setUser(null);
      return false;
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const generation = sessionGeneration.current;
      try {
        const accessToken = authService.getAccessToken();
        
        const refreshToken = authService.getRefreshToken();

        if (!accessToken && !refreshToken) {
          if (generation === sessionGeneration.current) setUser(null);
          return;
        }

        if (!accessToken && refreshToken) {
          try {
            await authService.refreshToken();
          } catch (error) {
            if (generation === sessionGeneration.current) setUser(null);
            return;
          }
        }

        if (generation === sessionGeneration.current) await fetchUserProfile();
      } catch {
        if (generation === sessionGeneration.current) setUser(null);
      } finally {
        if (generation === sessionGeneration.current) setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const generation = sessionGeneration.current;
    const response = await authService.login(email, password);
    if (!response.success || generation !== sessionGeneration.current || !await fetchUserProfile()) {
      throw new Error('Could not confirm your session. Please sign in again.');
    }
  };

  const signup = async (data: SignupData) => {
    try {
      const response = await authService.signup(data);
      return response;
    } catch (error: any) {
      throw error;
    }
  };

  const verifyOtp = async (email: string, otp: string) => {
    const generation = sessionGeneration.current;
    let response;
    try {
      response = await authService.verifyOtp(email, otp);
    } catch (error: any) {
      const verificationError = new Error(error.response?.data?.message || 'OTP verification failed') as Error & { code?: string };
      verificationError.code = error.response?.data?.code;
      throw verificationError;
    }
    if (!response.success) {
      const verificationError = new Error(response.message || 'OTP verification failed') as Error & { code?: string };
      verificationError.code = (response as typeof response & { code?: string }).code;
      throw verificationError;
    }

    try {
      if (!response.accessToken || !response.refreshToken) throw new Error('Missing session tokens');
      if (generation !== sessionGeneration.current) throw new Error('Session changed');
      authService.setTokens(response);
      const profile = await authService.validateSession();
      if (!profile.success || !profile.user) throw new Error('Profile unavailable');
      if (generation !== sessionGeneration.current) throw new Error('Session changed');
      setUser(profile.user);
    } catch {
      if (generation === sessionGeneration.current) setUser(null);
      throw new VerificationSessionError();
    }

    let pendingEducatorRegistration: string | null = null;
    try {
      pendingEducatorRegistration = localStorage.getItem('pendingEducatorRegistration');
      if (pendingEducatorRegistration) localStorage.removeItem('pendingEducatorRegistration');
    } catch {
      // Optional intent must not invalidate a completed email verification.
    }
    router.push(pendingEducatorRegistration ? '/educator/register' : '/dashboard');
  };

  const logout = async () => {
    sessionGeneration.current++;
    setUser(null);
    setLoading(false);
    try {
      await authService.logout();
    } catch { /* Local sign-out is authoritative. */ }
  };
  const forgotPassword = async (email: string) => {
    try {
      const response = await authService.forgotPassword(email);
      return {
        success: true,
        message: response.data.message
      };
    } catch (error: any) {
      console.error('Password reset email is unavailable');
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
      console.error('Password reset could not be completed');
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to reset password'
      };
    }
  };
  const refreshUser = async () => {
    try {
      if (!await fetchUserProfile()) throw new Error('Could not refresh your profile. Please sign in again.');
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






