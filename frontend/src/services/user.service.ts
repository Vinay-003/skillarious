import axios from 'axios';
import authService from './auth.service';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
export type ProfileUpdate = { name: string; phone: string; gender: string; age: number | null };
type ProfileResponse = { success: boolean; message?: string; data?: ProfileUpdate & { email: string; pfp?: string } };

class UserService {
  private getHeaders() {
    return { Authorization: `Bearer ${authService.getAccessToken()}` };
  }

  async updateProfile(profileData: ProfileUpdate): Promise<ProfileResponse> {
    const { name, phone, gender, age } = profileData;
    const response = await axios.put(`${API_URL}/users/updateprofile`, { name, phone, gender, age }, {
      withCredentials: true, headers: { ...this.getHeaders(), 'Content-Type': 'application/json' }, timeout: 8000
    });
    return response.data;
  }

  async getProfile(): Promise<ProfileResponse> {
    const response = await axios.get(`${API_URL}/users/getprofile`, { headers: this.getHeaders(), timeout: 8000 });
    return response.data;
  }
}
const userService = new UserService();
export default userService;
