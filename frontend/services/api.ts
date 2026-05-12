import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://localhost:9000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const RAG_RESULT_STORAGE_KEY = 'intellideploy:last-rag-search';

export type RepoProfile = {
  source_repo_url?: string | null;
  detected_languages?: string[] | null;
  detected_frameworks?: string[] | null;
  package_manager?: string | null;
  entrypoints?: string[] | null;
  dependency_files?: string[] | null;
  has_valid_dockerfile?: boolean | null;
  readme_summary?: string | null;
};

export type RagCandidate = {
  rank: number;
  repo_url: string;
  full_name: string;
  name: string;
  owner: string;
  description?: string | null;
  default_branch?: string | null;
  topics: string[];
  stars: number;
  forks: number;
  language?: string | null;
  is_archived: boolean;
  last_commit_at?: string | null;
  retrieval_sources: string[];
  retrieval_score: number;
  deployability_score: number;
  final_score: number;
  rerank_stage: string;
  match_reasons: string[];
  readme_summary?: string | null;
  repo_profile: RepoProfile;
  missing_components: string[];
};

export type RepoIntent = {
  raw_query: string;
  keywords: string[];
  github_query: string;
  tech_stack: string[];
  target_app_type: string;
  target_output_type: string;
  is_frontend_only: boolean;
  has_database?: boolean | null;
  constraints: Record<string, unknown>;
};

export type RagSearchResponse = {
  request_id: string;
  intent: RepoIntent;
  candidates: RagCandidate[];
  selected?: RagCandidate | null;
  generated_at: string;
  warnings: string[];
};

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

export const ragAPI = {
  search: (rawQuery: string) =>
    api.post<RagSearchResponse>('/api/rag/search', {
      raw_query: rawQuery,
      top_k: 3,
      include_readme: true,
    }),
};

export default api;
