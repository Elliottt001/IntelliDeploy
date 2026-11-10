import axios from 'axios';
import { createApiClient } from '@intellideploy/api-client';
import { authStorage } from './authStorage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:9000';
type AuthListener = (token: string | null) => void;
const authListeners = new Set<AuthListener>();
const notify = (token: string | null) => authListeners.forEach(listener => listener(token));
const api = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });
api.interceptors.request.use(async config => {
  const token = await authStorage.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(response => response, async error => {
  if (error.response?.status === 401) await authAPI.clearToken();
  return Promise.reject(error);
});

export const authAPI = {
  register: (username: string, email: string, password: string) => api.post('/auth/register', { username, email, password }),
  login: (username: string, password: string) => api.post<{ access_token: string }>('/auth/login', { username, password }),
  getMe: () => api.get<{ id: number; username: string }>('/auth/me'),
  getToken: authStorage.getToken,
  setToken: async (token: string) => { await authStorage.setToken(token); notify(token); },
  clearToken: async () => { await authStorage.clearToken(); notify(null); },
  subscribe: (listener: AuthListener) => { authListeners.add(listener); return () => { authListeners.delete(listener); }; },
};

// Polling cancellation and request deadlines apply to the same shared transport.
const mobileFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const abort = () => controller.abort();
  init?.signal?.addEventListener('abort', abort);
  if (init?.signal?.aborted) controller.abort();
  const deadline = setTimeout(abort, 30000);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    if (response.status === 401) await authAPI.clearToken();
    return response;
  } finally {
    clearTimeout(deadline);
    init?.signal?.removeEventListener('abort', abort);
  }
};
export const phase1Api = createApiClient({ baseUrl: API_BASE_URL, getToken: authStorage.getToken, fetchImpl: mobileFetch });
export default api;
