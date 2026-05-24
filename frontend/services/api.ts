import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:9000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

export const AUTH_TOKEN_STORAGE_KEY = 'token';
export const RAG_RESULT_STORAGE_KEY = 'intellideploy:last-rag-search';
export const DEPLOYMENT_STATUS_STORAGE_KEY = 'intellideploy:active-deployment-id';

export type PipelineStage =
  | 'Thinking'
  | 'Building'
  | 'Reviewing'
  | 'SecurityCheck'
  | 'Consensus'
  | 'Generating'
  | 'Packaging'
  | 'Deploying'
  | 'HealthCheck'
  | 'Healing'
  | 'Finalize';

export type PipelineStageStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export type PipelineStageMessage = {
  type: 'pipeline_stage';
  deployment_id: string;
  stage: PipelineStage;
  status: PipelineStageStatus;
  message: string;
  progress?: number;
  data?: Record<string, unknown>;
  timestamp: string;
};

export type DeploymentWebSocketMessage =
  | PipelineStageMessage
  | {
      type: 'status' | 'log' | 'event' | 'error';
      deployment_id: string;
      status?: string;
      log?: string;
      level?: string;
      event_type?: string;
      error_message?: string;
      data?: Record<string, unknown>;
      timestamp: string;
    };

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

export type RagStartGenerationResponse = {
  search: RagSearchResponse;
  generation: {
    accepted: boolean;
    task_id: string;
    status: string;
    queued_at: string;
    message?: string | null;
  };
};

export type RagChatResponse = RagStartGenerationResponse & {
  project_id: string;
  deployment_id: string;
};

type RetrievalCandidate = {
  rank?: number | null;
  full_name: string;
  repo_url?: string;
  html_url?: string;
  description?: string;
  stars?: number;
  forks?: number;
  is_archived?: boolean;
  last_commit_at?: string | null;
  pushed_at?: string | null;
  language?: string | null;
  topics?: string[];
  default_branch?: string | null;
  retrieval_score?: number;
  source_scores?: Record<string, number>;
  score?: number;
  score_breakdown?: Record<string, number>;
  readme_snippet?: string;
};

type RetrievalSearchResponse = {
  intent: {
    raw_query: string;
    keywords?: string[];
    github_query?: string;
    tech_stack?: string[];
    target_app_type?: string;
    target_output_type?: string;
    is_frontend_only?: boolean;
    has_database?: boolean;
    constraints?: Record<string, unknown>;
  };
  candidates: RetrievalCandidate[];
  repository_profile?: RepoProfile | null;
};

// 请求拦截器：自动添加 token
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type AuthListener = (token: string | null) => void;
const authListeners = new Set<AuthListener>();
function notifyAuthListeners(token: string | null) {
  authListeners.forEach((listener) => listener(token));
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      notifyAuthListeners(null);
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (username: string, email: string, password: string) =>
    api.post('/auth/register', { username, email, password }),
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  getMe: () => api.get('/auth/me'),
  clearToken: async () => {
    await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    notifyAuthListeners(null);
  },
  getToken: () => AsyncStorage.getItem(AUTH_TOKEN_STORAGE_KEY),
  setToken: async (token: string) => {
    await AsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    notifyAuthListeners(token);
  },
  subscribe: (listener: AuthListener) => {
    authListeners.add(listener);
    return () => {
      authListeners.delete(listener);
    };
  },
};

export const ragAPI = {
  search: async (rawQuery: string) => {
    const response = await api.post<RagSearchResponse>('/api/rag/search', {
      raw_query: rawQuery,
      top_k: 3,
    });
    return response;
  },
  chat: async (rawQuery: string) => {
    const response = await api.post<RagChatResponse>('/api/rag/chat', {
      raw_query: rawQuery,
      top_k: 3,
    });
    return response;
  },
  startGeneration: async (payload: {
    project_id: string;
    deployment_id: string;
    raw_query: string;
    request_id?: string;
    selected_repo_url?: string;
  }) => {
    const response = await api.post<RagStartGenerationResponse>('/api/rag/start-generation', payload);
    return response;
  },
};

export function deploymentWebSocketUrl(deploymentId: string | number): string {
  return `${API_BASE_URL.replace(/^http/, 'ws')}/ws/deployments/${deploymentId}`;
}

export default api;

function mapRetrievalToRagSearch(data: RetrievalSearchResponse): RagSearchResponse {
  const candidates = data.candidates.map((candidate, index) => {
    const repoUrl = candidate.repo_url || candidate.html_url || '';
    const score = candidate.score || candidate.retrieval_score || 0;
    const profile = index === 0 && data.repository_profile ? data.repository_profile : {};
    return {
      rank: candidate.rank || index + 1,
      repo_url: repoUrl,
      full_name: candidate.full_name,
      name: candidate.full_name.split('/').pop() || candidate.full_name,
      owner: candidate.full_name.includes('/') ? candidate.full_name.split('/')[0] : '',
      description: candidate.description || '',
      default_branch: candidate.default_branch || null,
      topics: candidate.topics || [],
      stars: candidate.stars || 0,
      forks: candidate.forks || 0,
      language: candidate.language || null,
      is_archived: Boolean(candidate.is_archived),
      last_commit_at: candidate.last_commit_at || candidate.pushed_at || null,
      retrieval_sources: Object.keys(candidate.source_scores || {}),
      retrieval_score: score,
      deployability_score: deployabilityScore(candidate.score_breakdown || {}),
      final_score: score,
      rerank_stage: candidate.score_breakdown ? 'coarse' : 'fallback',
      match_reasons: matchReasons(candidate),
      readme_summary: profile.readme_summary || candidate.readme_snippet || candidate.description || null,
      repo_profile: {
        source_repo_url: profile.source_repo_url || repoUrl,
        detected_languages: profile.detected_languages || (candidate.language ? [candidate.language] : []),
        detected_frameworks: profile.detected_frameworks || [],
        package_manager: profile.package_manager || null,
        entrypoints: profile.entrypoints || [],
        dependency_files: profile.dependency_files || [],
        has_valid_dockerfile: profile.has_valid_dockerfile ?? null,
        readme_summary: profile.readme_summary || candidate.readme_snippet || candidate.description || null,
      },
      missing_components: [],
    };
  });
  return {
    request_id: `retrieval-${Date.now()}`,
    intent: {
      raw_query: data.intent.raw_query,
      keywords: data.intent.keywords || [],
      github_query: data.intent.github_query || '',
      tech_stack: data.intent.tech_stack || [],
      target_app_type: data.intent.target_app_type || 'unknown',
      target_output_type: data.intent.target_output_type || 'repository',
      is_frontend_only: Boolean(data.intent.is_frontend_only),
      has_database: data.intent.has_database ?? null,
      constraints: data.intent.constraints || {},
    },
    candidates,
    selected: candidates[0] || null,
    generated_at: new Date().toISOString(),
    warnings: [],
  };
}

function deployabilityScore(scoreBreakdown: Record<string, number>): number {
  return Math.min(
    (scoreBreakdown.docker_bonus || 0) +
      (scoreBreakdown.template_stack_bonus || 0) +
      (scoreBreakdown.package_structure || 0),
    100
  );
}

function matchReasons(candidate: RetrievalCandidate): string[] {
  const sources = Object.keys(candidate.source_scores || {}).map((source) => `source:${source}`);
  const scores = Object.entries(candidate.score_breakdown || {})
    .filter(([, value]) => value > 0)
    .map(([key]) => `score:${key}`);
  return [...sources, ...scores];
}
