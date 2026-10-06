import axios from 'axios';
import authService from './auth.service';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
export interface PaymentCreateResponse { success: boolean; order: { id: string; approvalUrl: string }; message?: string }
export interface PaymentVerifyResponse { success: boolean; message?: string; data?: { transactionId: string; amount: number; status: string } }
class PaymentService {
  private static headers() { return { Authorization: `Bearer ${authService.getAccessToken()}` }; }
  static async createPayment(courseId: string): Promise<PaymentCreateResponse> { const response = await axios.post(`${API_URL}/payments/create`, { courseId }, { headers: this.headers() }); const data = response.data; return { ...data, order: data.order || (data.orderId && data.approvalUrl ? { id: data.orderId, approvalUrl: data.approvalUrl } : undefined) }; }
  static async verifyPayment(data: { orderId: string; courseId: string }): Promise<PaymentVerifyResponse> { const response = await axios.post(`${API_URL}/payments/verify`, data, { headers: this.headers() }); return response.data; }
}
export default PaymentService;
