import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const configuredBaseUrl =
  (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_API_BASE_URL;

const API_BASE_URL =
  configuredBaseUrl ?? (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器：自动添加 token
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (username: string, email: string, password: string) =>
    api.post('/auth/register', { username, email, password }),
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  getMe: () => api.get('/auth/me'),
};

export type HomeFeedResponse = {
  greeting: {
    userId: string;
    nickname: string;
    avatarUrl?: string | null;
    mascotUrl?: string | null;
    bubbleText: string;
    dailyTipId?: string | null;
  };
  inspirationPool: {
    title: string;
    keywords: Array<{
      keyword: string;
      rank: number;
      rankingId: string;
    }>;
  };
  navCards: Array<{
    key: string;
    title: string;
    iconUrl?: string | null;
    route: string;
  }>;
};

export const homeAPI = {
  getFeed: () => api.get<HomeFeedResponse>('/api/home/feed'),
};

export default api;
