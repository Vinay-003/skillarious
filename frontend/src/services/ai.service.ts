import api from '@/lib/axios';
export type LearningSource = { id: string; title: string; excerpt: string };
export type LearningResponse = { success: boolean; answer: string; model: string; fallback: boolean; sources: LearningSource[]; toolReferences: Array<{ name: string; resourceId?: string; access: string }>; disclosure: string };
export type Recommendation = { id: string; name: string; description: string | null; educatorId: string; educatorName: string; price: string; rating: number; reviewCount: number; reason: string };
export type AiConversation = { id: string; userId: string; contextType: 'course' | 'content' | 'doubt'; contextId: string; title: string; archived: boolean; createdAt: string; updatedAt: string };
export type AiMessage = { id: string; conversationId: string; role: 'user' | 'assistant'; content: string; model?: string | null; sources?: LearningSource[] | null; createdAt: string };
const aiService = {
  async ask(input: { question: string; courseId?: string; contentId?: string; doubtId?: string; conversationId?: string }) { return (await api.post<LearningResponse>('/ai/ask', input)).data; },
  async listConversations(contextType: AiConversation['contextType'], contextId: string) { return (await api.get<{ success: boolean; conversations: AiConversation[] }>('/ai/conversations', { params: { contextType, contextId } })).data; },
  async createConversation(input: { contextType: AiConversation['contextType']; contextId: string; title: string }) { return (await api.post<{ success: boolean; conversation: AiConversation }>('/ai/conversations', input)).data; },
  async getConversation(id: string) { return (await api.get<{ success: boolean; conversation: AiConversation; messages: AiMessage[] }>(`/ai/conversations/${id}`)).data; },
  async archiveConversation(id: string) { return (await api.post<{ success: boolean; conversation: AiConversation }>(`/ai/conversations/${id}/archive`)).data; },
  async recommend(subject: string) { return (await api.post<{ success: boolean; recommendations: Recommendation[]; method: string }>('/ai/recommend', { subject })).data; },
};
export default aiService;
