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

// Chat API — 对接后端 /chat 路由，后端未就绪时 mock 数据兜底
export const chatAPI = {
  // 创建会话，返回 { session_id }
  createSession: () =>
    api.post('/chat/session').catch(() => ({
      data: { session_id: `mock-${Date.now()}` },
    })),

  // 发送消息（WebSocket 不可用时的 HTTP fallback）
  // 返回 { content, status }，格式与 intellideploy_prompts.py RESPONSE_SCHEMA 对齐
  sendMessage: (session_id: string, content: string) =>
    api
      .post('/chat/message', { session_id, content })
      .catch(() => ({
        data: {
          content:
            '收到你的请求，正在分析项目结构...\n\n检测到技术栈：Node.js + Express\n推荐镜像：`node:18-alpine`\n\n正在生成 Dockerfile 和 K8s 配置，请稍候。',
          status: 'building' as const,
        },
      })),
};

// App Gallery API — 获取可部署的应用列表
export const galleryAPI = {
  listApps: (params?: { search?: string; category?: string; page?: number }) =>
    api.get('/gallery/apps', { params }).catch(() => ({ data: { apps: [], total: 0 } })),

  getApp: (id: string) =>
    api.get(`/gallery/apps/${id}`).catch(() => ({ data: null })),
};

export default api;
