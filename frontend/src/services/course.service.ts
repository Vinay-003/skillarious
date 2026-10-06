import axios from 'axios';
const API_URL = process.env.NEXT_PUBLIC_API_URL;
import authService from './auth.service';

const CourseService = {
  // Public methods (available to all users)
  getAllCourses: async () => {
    try {
      const response = await axios.get(`${API_URL}/courses/all`);
      return response.data;
    } catch (error) {
      console.error('Error in getAllCourses:', error);
      throw error;
    }
  },

  getSingleCourse: async (courseId: string) => {
    const response = await axios.get(`${API_URL}/courses/single/${courseId}`);
    return response.data;
  },

  searchCourses: async (query: string) => {
    try {
      const response = await axios.get(`${API_URL}/courses/search?name=${encodeURIComponent(query)}&description=${encodeURIComponent(query)}&about=${encodeURIComponent(query)}`);
      return {
        success: true,
        message: 'Courses searched successfully',
        courses: response.data.courses || []
      };
    } catch (error) {
      console.error('Error searching courses:', error);
      throw error;
    }
  },

  // Access control methods (authenticated users)
  checkCourseOwnership: async (courseId: string) => {
    try {
      const response = await axios.get(`${API_URL}/courses/ownership/${courseId}`, {
        headers: { Authorization: `Bearer ${authService.getAccessToken()}` }
      });
      return response.data;
    } catch (error) {
      return { success: false, isOwner: false };
    }
  },

  checkCourseAccess: async (courseId: string) => {
    try {
      const response = await axios.get(`${API_URL}/courses/access/${courseId}`, {
        headers: { Authorization: `Bearer ${authService.getAccessToken()}` }
      });
      return response.data;
    } catch (error) {
      return { success: false, hasAccess: false };
    }
  },

  // Student methods
  purchaseCourse: async (courseId: string) => {
    const response = await axios.post(
      `${API_URL}/courses/purchase/${courseId}`,
      {},
      { headers: { Authorization: `Bearer ${authService.getAccessToken()}` } }
    );
    return response.data;
  },

  // Educator methods (protected by backend authorization)
  createCourse: async (educatorId: string, courseData: any) => {
    try {
      const token = authService.getAccessToken();
      console.log('Creating course with token:', token ? 'Present' : 'Missing');
      
      const response = await axios.post(
        `${API_URL}/courses/create/${educatorId}`,
        courseData.body, // Send just the body data
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Course service error:', {
        status: error.response?.status,
        message: error.response?.data?.message,
        educatorId
      });
      throw error;
    }
  },

  updateCourse: async (courseId: string, courseData: any) => {
    const response = await axios.put(
      `${API_URL}/courses/update/${courseId}`,
      courseData,
      { headers: { Authorization: `Bearer ${authService.getAccessToken()}` } }
    );
    return response.data;
  },

  deleteCourse: async (courseId: string) => {
    const response = await axios.delete(
      `${API_URL}/courses/delete/${courseId}`,
      { headers: { Authorization: `Bearer ${authService.getAccessToken()}` } }
    );
    return response.data;
  },

  getCoursesByEducator: async (educatorId: string) => {
    try {
      const response = await axios.get(
        `${API_URL}/courses/educator/${educatorId}`,
        { headers: { Authorization: `Bearer ${authService.getAccessToken()}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching educator courses:', error);
      throw error;
    }
  }
};

export default CourseService;

