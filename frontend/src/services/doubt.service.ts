import axios from 'axios';

import { Doubt, Message } from '@/types';
import authService from './auth.service';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

class DoubtService {
  private getHeaders() {
    return {
      'Authorization': `Bearer ${authService.getAccessToken()}`
    };
  }

  async createDoubt(contentId: string, title: string, description: string) {
    try {
      const response = await axios.post(
        `${API_URL}/content/createDoubt`,
        { contentId, title, description },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error creating doubt:', error);
      throw error;
    }
  }

  async replyToDoubt(doubtId: string, content: string) {
    try {
      const response = await axios.post(
        `${API_URL}/content/replyToDoubt/${doubtId}`,
        { content },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error replying to doubt:', error);
      throw error;
    }
  }

  async getDoubtDetails(doubtId: string) {
    try {
      const response = await axios.get(
        `${API_URL}/content/doubts/${doubtId}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching doubt details:', error);
      throw error;
    }
  }

  async getDoubts(filter: 'all' | 'open' | 'resolved') {
    try {
      const response = await axios.get(
        `${API_URL}/content/doubts?filter=${filter}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching doubts:', error);
      throw error;
    }
  }

  async getDoubtsByContent(contentId: string) {
    try {
      const response = await axios.get(
        `${API_URL}/content/doubts/content/${contentId}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching content doubts:', error);
      return {
        success: false,
        message: 'Failed to fetch content doubts',
        doubts: []
      };
    }
  }
}

export const doubtService = new DoubtService();
