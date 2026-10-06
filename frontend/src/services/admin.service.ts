import axios from 'axios';
import authService from './auth.service';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const adminApi = axios.create({ baseURL: `${API_URL}/admin` });
adminApi.interceptors.request.use(config => {
  if (config.url !== '/register') {
    const token = authService.getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const adminService = {
  registerAdmin: (data: { name: string; email: string; password: string; inviteToken: string }) => adminApi.post('/register', data),
  getPlatformOverview: () => adminApi.get('/overview'),
  getUsers: () => adminApi.get('/users'),
  banUser: (userId: string, reason: string) => adminApi.post(`/moderate/user/${encodeURIComponent(userId)}/ban`, { reason }),
  unbanUser: (userId: string) => adminApi.post(`/moderate/user/${encodeURIComponent(userId)}/unban`, { reason: 'Ban lifted' }),
  getCourses: () => adminApi.get('/courses'),
  dismissCourse: (courseId: string, reason: string) => adminApi.post(`/moderate/course/${encodeURIComponent(courseId)}/dismiss`, { reason }),
  approveCourse: (courseId: string) => adminApi.post(`/moderate/course/${encodeURIComponent(courseId)}/approve`),
  getActionLogs: () => adminApi.get('/logs'),
  getReports: () => adminApi.get('/reports'),
  resolveReport: (reportId: string, resolution: string) => adminApi.post(`/reports/${encodeURIComponent(reportId)}/resolve`, { resolution }),
};

export default adminService;
