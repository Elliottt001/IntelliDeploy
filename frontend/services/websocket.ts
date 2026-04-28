/**
 * WebSocket 服务 — 接收后端 Agent 状态流
 *
 * 后端推送的消息格式（约定）：
 * {
 *   type: 'status' | 'message' | 'error' | 'done'
 *   status?: 'thinking' | 'building' | 'healing' | 'done' | 'error'
 *   content?: string
 *   session_id?: string
 * }
 */

export type AgentStatus = 'thinking' | 'building' | 'healing' | 'done' | 'error';

export interface WSMessage {
  type: 'status' | 'message' | 'error' | 'done';
  status?: AgentStatus;
  content?: string;
  session_id?: string;
}

type StatusHandler = (status: AgentStatus) => void;
type MessageHandler = (content: string, status?: AgentStatus) => void;
type ErrorHandler = (error: string) => void;

const WS_BASE_URL = 'ws://localhost:9000';

class DeployWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private maxReconnectAttempts = 0;
  private reconnectAttempts = 0;

  private onStatusChange?: StatusHandler;
  private onMessage?: MessageHandler;
  private onError?: ErrorHandler;
  private onClose?: () => void;

  connect(
    sessionId: string,
    token: string,
    handlers: {
      onStatusChange?: StatusHandler;
      onMessage?: MessageHandler;
      onError?: ErrorHandler;
      onClose?: () => void;
    }
  ) {
    this.sessionId = sessionId;
    this.onStatusChange = handlers.onStatusChange;
    this.onMessage = handlers.onMessage;
    this.onError = handlers.onError;
    this.onClose = handlers.onClose;

    this._connect(token);
  }

  private _connect(token: string) {
    if (this.ws) {
      this.ws.close();
    }

    const url = `${WS_BASE_URL}/ws/deploy/${this.sessionId}?token=${token}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        this._handleMessage(msg);
      } catch {
        // 纯文本 fallback
        this.onMessage?.(event.data);
      }
    };

    this.ws.onerror = () => {
      this.onError?.('连接出现错误，正在重试...');
    };

    this.ws.onclose = () => {
      this.onClose?.();
      this._tryReconnect(token);
    };
  }

  private _handleMessage(msg: WSMessage) {
    switch (msg.type) {
      case 'status':
        if (msg.status) this.onStatusChange?.(msg.status);
        break;
      case 'message':
        this.onMessage?.(msg.content ?? '', msg.status);
        break;
      case 'error':
        this.onError?.(msg.content ?? '未知错误');
        break;
      case 'done':
        this.onMessage?.(msg.content ?? '', 'done');
        break;
    }
  }

  private _tryReconnect(token: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this._connect(token);
    }, 2000 * this.reconnectAttempts);
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectAttempts = this.maxReconnectAttempts; // 阻止重连
    this.ws?.close();
    this.ws = null;
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// 单例
export const deployWS = new DeployWebSocket();
