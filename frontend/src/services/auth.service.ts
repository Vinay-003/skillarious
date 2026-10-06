import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  success: boolean;
  message: string;
}

class AuthService {
  private refreshInFlight: Promise<AuthResponse> | null = null;
  private sessionGeneration = 0;

  getSessionGeneration() { return this.sessionGeneration; }

  isInvalidRefresh(error: unknown) {
    return axios.isAxiosError(error) && [401, 403, 404].includes(error.response?.status ?? 0);
  }

  async login(email: string, password: string) {
    const generation = this.sessionGeneration;
    const response = await axios.post<AuthResponse>(`${API_URL}/auth/login`, {
      email,
      password,
    }, { timeout: 10000 });

    
    if (!response.data.success) {
      throw new Error(response.data.message);
    }
    
    if (!response.data.accessToken || !response.data.refreshToken || generation !== this.sessionGeneration) throw new Error('Could not establish a session. Please sign in again.');
    this.setTokens(response.data);
    return response.data
  }

  async signup(signupData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    gender?: string;
    age?: number;
  }) {

    const response = await axios.post(`${API_URL}/auth/signup`, signupData, {
      headers: {
        'Content-Type': 'application/json'
      }, timeout: 20000
    });

    return response.data;
  }

  async resendOtp(email: string) {
    const response = await axios.post(`${API_URL}/otp/generate`, { email }, { timeout: 15000 });
    return response.data;
  }

  async verifyOtp(email: string, otp: string) {
    const response = await axios.post<AuthResponse>(`${API_URL}/otp/verify`, {
      email,
      otp,
    }, { timeout: 10000 });

    return response.data;
  }

  async refreshToken() {
    if (this.refreshInFlight) return this.refreshInFlight;
    const refreshToken = this.getRefreshToken();
    const generation = this.sessionGeneration;
    const pending = (async () => {
      if (!refreshToken) throw new Error('No refresh token found');

      const response = await axios.post<AuthResponse>(`${API_URL}/auth/refreshtoken`, {
        token: refreshToken
      }, { timeout: 10000 });

      if (response.data.accessToken && response.data.refreshToken && generation === this.sessionGeneration && this.getRefreshToken() === refreshToken) {
        this.setTokens(response.data);
      }
      return response.data;
    })();
    this.refreshInFlight = pending;
    try { return await pending; }
    catch (error) {
      if (this.isInvalidRefresh(error) && generation === this.sessionGeneration && this.getRefreshToken() === refreshToken) this.clearTokens();
      throw error;
    } finally { if (this.refreshInFlight === pending) this.refreshInFlight = null; }
  }

  async forgotPassword(email: string) {
    try {
      const response = await axios.post(`${API_URL}/auth/forgotpassword`, { email }, { timeout: 15000 });
      return response; // Return the entire response
    } catch (error: any) {

      throw error;
    }
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    try {
      const response = await axios.post(`${API_URL}/auth/resetpassword`, {
        email,
        otp,
        newPassword
      }, { timeout: 10000 });
      return {
        success: response.data.success,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to reset password'
      };
    }
  }

  async logout() {
    const refreshToken = this.getRefreshToken();
    this.sessionGeneration++;
    this.clearTokens();
    for (const key of ['user', 'pendingEducatorRegistration']) {
      try { localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
    }
    try {
      if (refreshToken) {
        await axios.post(`${API_URL}/auth/logout`, { refreshToken }, { timeout: 3000 });
      }
    } catch { /* Local session is already cleared even when revocation fails. */ }
  }

  setTokens(data: Pick<AuthResponse, 'accessToken' | 'refreshToken'>) {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `accessToken=${data.accessToken}; path=/; SameSite=Lax; Max-Age=900${secure}`;
    document.cookie = `refreshToken=${data.refreshToken}; path=/; SameSite=Lax; Max-Age=604800${secure}`;
  }

  getAccessToken() {
    return this.getCookie('accessToken');
  }

  getRefreshToken() {
    return this.getCookie('refreshToken');
  }

  clearTokens() {
    document.cookie = `accessToken=;expires=${new Date().toUTCString()};path=/`;
    document.cookie = `refreshToken=;expires=${new Date().toUTCString()};path=/`;
  }

  private getCookie(name: string) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return null;
  }

  async validateSession() {
    try {
      const response = await axios.get(`${API_URL}/auth/validate`, {
        headers: {
          Authorization: `Bearer ${this.getAccessToken()}`
        }, timeout: 10000
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid session');
      }
      throw error;
    }
  }

  async getProfile() {
    try {
      const response = await axios.get(`${API_URL}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${this.getAccessToken()}`
        }, timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Profile could not be loaded');
      throw error;
    }
  }

  // Setup axios interceptor for automatic token refresh
  setupAxiosInterceptors() {
    axios.interceptors.request.use(
      (config) => {
        if (config.url === `${API_URL}/auth/login`) {
          return config;
        }
        const token = this.getAccessToken();

        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
          return Promise.reject(error);
      }
    );

    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry && originalRequest.url !== `${API_URL}/auth/refreshtoken` && originalRequest.url !== `${API_URL}/auth/logout`) {
          originalRequest._retry = true;
          if(originalRequest.url === `${API_URL}/auth/login`) {
            return Promise.reject(error);
          }
          
          try {
            const generation = this.sessionGeneration;
            await this.refreshToken();
            if (generation !== this.sessionGeneration) return Promise.reject(error);
            const token = this.getAccessToken();
            if (!token) return Promise.reject(error);
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return axios(originalRequest);
          } catch (refreshError) {
            // Another request may have already rotated the token.
            // window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }
}

const authService = new AuthService();
authService.setupAxiosInterceptors();
export default authService;
