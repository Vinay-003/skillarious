import axios from 'axios';
import authService from './auth.service';
import { AxiosError } from 'axios';
const API_URL = process.env.NEXT_PUBLIC_API_URL;

class EducatorService {
  private getHeaders() {
    return {
      'Authorization': `Bearer ${authService.getAccessToken()}`
    };
  }

// register as educator
async registerAsEducator(bio: string, about: string, doubtOpen: boolean) {
  try {
    const response = await axios.post(`${API_URL}/educators/register`, {
      bio,
      about,
      doubtOpen
    }, {
      withCredentials: true,
      headers: this.getHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('Error registering as educator:', error);
    throw error;
  }
};
// Get educator profile
async getEducatorProfile() {
  try {
    console.log('Making request to get educator profile...');
    const response = await axios.get(`${API_URL}/educators/profile`, {
      withCredentials: true,
      headers: this.getHeaders()
    });
    console.log('Received profile response:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('Error in getEducatorProfile:', error);
    if ((error as AxiosError).response?.status === 401) {
      await authService.logout();
      window.location.href = '/login';
      throw error;
    }
    if ((error as AxiosError).response?.status === 404) {
      return {
        success: false,
        message: 'Educator profile not found'
      };
    }
    throw error;
  }
};
// Update educator profile
async updateEducatorProfile(data: { bio?: string; about?: string; doubtOpen?: boolean }) {
  try {
    const response = await axios.put(`${API_URL}/educators/profile`, data, {
      withCredentials: true,
      headers: this.getHeaders()
    });
    return response.data;
  }
  catch (error) {
    console.error('Error updating educator profile:', error);
    throw error;
  }
};
// Toggle doubt availability
async toggleDoubtAvailability() {
  try{
    const response = await axios.patch(`${API_URL}/educators/toggle-doubt`, {}, {
      withCredentials: true,
      headers: this.getHeaders()
    });
    return response.data;
  }
  catch (error) {
    console.error('Error toggling doubt availability:', error);
    throw error;
  }
};

  

  async getEducatorCourses() {
    try {
      // Get current educator profile first
      const educatorResponse = await axios.get(`${API_URL}/educators/profile`, {
        headers: this.getHeaders()
      });
      
      const educatorId = educatorResponse.data.data.id;
      
      // Then get courses using educator ID
      const coursesResponse = await axios.get(`${API_URL}/courses/educator/${educatorId}`, {
        headers: this.getHeaders()
      });

      return coursesResponse.data;
    } catch (error) {
      console.error('Error fetching educator courses:', error);
      throw error;
    }
  }

  async getEdCourses(edid: string) {
    try {
      const response = await axios.get(`${API_URL}/courses/educator/${edid}`, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching educator courses:', error);
      throw error;
    }
  }

}
export default new EducatorService();


















