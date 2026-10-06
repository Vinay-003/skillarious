import api from '@/lib/axios';
export type LearningSource = { id: string; title: string; excerpt: string };
export type LearningResponse = { success: boolean; answer: string; model: string; fallback: boolean; sources: LearningSource[]; toolReferences: Array<{ name: string; resourceId?: string; access: string }>; disclosure: string };
export type Recommendation = { id: string; name: string; description: string | null; educatorId: string; educatorName: string; price: string; rating: number; reviewCount: number; reason: string };
const aiService = {
  async ask(input: { question: string; courseId?: string; contentId?: string; doubtId?: string }) { return (await api.post<LearningResponse>('/ai/ask', input)).data; },
  async recommend(subject: string) { return (await api.post<{ success: boolean; recommendations: Recommendation[]; method: string }>('/ai/recommend', { subject })).data; },
};
export default aiService;
