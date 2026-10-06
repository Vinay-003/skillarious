import axios from 'axios';
import authService from './auth.service';

export interface LibraryCourse {
  id: string;
  name: string;
  description: string;
  thumbnail: string | null;
  educatorId: string;
  educatorName: string;
  viewedAt?: string;
}
export interface Playlist { id: string; name: string; courses: LibraryCourse[]; createdAt: string }
export interface Subscription { id: string; name: string; pfp: string | null; bio: string | null; subscribedAt: string }

const base = `${process.env.NEXT_PUBLIC_API_URL}/student`;
function config() {
  const token = authService.getAccessToken();
  if (!token) throw new Error('Please sign in to use your library.');
  return { headers: { Authorization: `Bearer ${token}` } };
}
async function request<T>(method: 'get' | 'put' | 'post' | 'delete', path: string, body?: object): Promise<T> {
  const response = await axios.request<{ success: boolean; data: T; message?: string }>({ method, url: `${base}${path}`, data: body, ...config() });
  if (!response.data?.success || response.data.data === undefined) throw new Error(response.data?.message || 'Library request failed');
  return response.data.data;
}
const id = (value: string) => encodeURIComponent(value);
const libraryService = {
  history: () => request<LibraryCourse[]>('get', '/history'),
  recordHistory: (courseId: string) => request<{ courseId: string }>('put', `/history/${id(courseId)}`),
  likes: () => request<LibraryCourse[]>('get', '/likes'),
  like: (courseId: string) => request('put', `/likes/${id(courseId)}`),
  unlike: (courseId: string) => request('delete', `/likes/${id(courseId)}`),
  playlists: () => request<Playlist[]>('get', '/playlists'),
  createPlaylist: (name: string) => request<Playlist>('post', '/playlists', { name }),
  deletePlaylist: (playlistId: string) => request('delete', `/playlists/${id(playlistId)}`),
  addCourse: (playlistId: string, courseId: string) => request('put', `/playlists/${id(playlistId)}/courses/${id(courseId)}`),
  removeCourse: (playlistId: string, courseId: string) => request('delete', `/playlists/${id(playlistId)}/courses/${id(courseId)}`),
  subscriptions: () => request<Subscription[]>('get', '/subscriptions'),
  follow: (educatorId: string) => request('put', `/subscriptions/${id(educatorId)}`),
  unfollow: (educatorId: string) => request('delete', `/subscriptions/${id(educatorId)}`)
};
export default libraryService;
export function libraryError(error: unknown): string {
  if (axios.isAxiosError(error)) return error.response?.data?.message || error.message || 'Library request failed';
  return error instanceof Error ? error.message : 'Library request failed';
}
