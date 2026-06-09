import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://localhost:9000';

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

export type NaturalLanguageDeployResponse = {
  status: string;
  message: string;
  selected_repository?: {
    full_name: string;
    repo_url?: string;
    description?: string;
  } | null;
  project_id?: number | null;
  deployment_id?: number | null;
  task_id?: string | null;
  artifact?: {
    deploy_ready: boolean;
    artifact_path?: string | null;
    summary?: string | null;
    runtime: {
      start_command: string;
      exposed_port: number;
      healthcheck_path?: string | null;
    };
  } | null;
  deployment_result?: {
    access_url?: string | null;
    status?: string;
  } | null;
};

export const nlDeployAPI = {
  start: (natural_language_query: string, deploy = true) =>
    api.post<NaturalLanguageDeployResponse>('/api/nl-deploy/start', {
      natural_language_query,
      deploy,
    }),
};

export default api;
