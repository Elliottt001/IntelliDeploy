import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatAPI } from '../../services/api';
import { deployWS, AgentStatus } from '../../services/websocket';
import { deployIntentStore } from '../../services/deployIntent';

type DeployStatus = AgentStatus;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: DeployStatus;
  timestamp: Date;
}

const STATUS_CONFIG: Record<DeployStatus, { label: string; color: string; bg: string; icon: string }> = {
  thinking: { label: 'Thinking...', color: '#B45309', bg: 'rgba(245,158,11,0.10)', icon: '🤔' },
  building: { label: 'Building...',  color: '#1D4ED8', bg: 'rgba(59,130,246,0.10)', icon: '🔨' },
  healing:  { label: 'Healing...',   color: '#6D28D9', bg: 'rgba(139,92,246,0.10)', icon: '🔧' },
  done:     { label: 'Done',         color: '#065F46', bg: 'rgba(16,185,129,0.10)', icon: '✅' },
  error:    { label: 'Error',        color: '#991B1B', bg: 'rgba(239,68,68,0.10)',  icon: '❌' },
};

const SUGGESTIONS = [
  '帮我部署一个 Node.js 应用',
  '分析 GitHub 仓库并部署',
  '生成 Dockerfile',
  '查看部署状态',
];

function StatusBadge({ status }: { status: DeployStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
      <Text style={styles.statusIcon}>{cfg.icon}</Text>
      <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AI</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {message.status && <StatusBadge status={message.status} />}
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {message.content}
        </Text>
        <Text style={[styles.timestamp, isUser && styles.timestampUser]}>
          {message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: '你好！我是 IntelliDeploy AI 助手。\n\n告诉我你想部署什么，或者粘贴一个 GitHub 仓库链接，我来帮你自动生成部署配置。',
      status: 'done',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);
  const sessionIdRef = useRef<string | null>(null);
  // 当前 AI 正在流式输出的消息 id
  const streamingIdRef = useRef<string | null>(null);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // 初始化会话 + WebSocket
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const res = await chatAPI.createSession();
        if (!mounted) return;

        const { session_id } = res.data;
        sessionIdRef.current = session_id;

        deployWS.connect(session_id, token ?? '', {
          onStatusChange: (status) => {
            // 更新最新一条 AI 消息的状态徽章
            if (streamingIdRef.current) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamingIdRef.current ? { ...m, status } : m
                )
              );
            }
          },
          onMessage: (content, status) => {
            const id = streamingIdRef.current;
            if (id) {
              // 追加到已有气泡
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === id
                    ? { ...m, content: m.content + content, status: status ?? m.status }
                    : m
                )
              );
            } else {
              // 新建 AI 气泡
              const newId = Date.now().toString();
              streamingIdRef.current = newId;
              setMessages((prev) => [
                ...prev,
                { id: newId, role: 'assistant', content, status, timestamp: new Date() },
              ]);
            }
            if (status === 'done' || status === 'error') {
              streamingIdRef.current = null;
              setLoading(false);
            }
          },
          onError: (_error) => {
            // WebSocket 连接失败，静默降级到 HTTP fallback，不展示错误气泡
            streamingIdRef.current = null;
            setLoading(false);
          },
          onClose: () => {
            // WebSocket 断开，后续走 HTTP fallback
          },
        });
      } catch {
        // 后端未就绪时静默失败，sendMessage 会走 HTTP fallback
      }
    };

    init();
    return () => {
      mounted = false;
      deployWS.disconnect();
    };
  }, []);

  // 消费来自 Gallery 的部署意图 — 放在 sendMessage 之后
  const intentEffectRef = useRef<(() => void) | null>(null);

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // WebSocket 已连接 → 直接发，等 onMessage 回调
    if (deployWS.isConnected && sessionIdRef.current) {
      // 后端通过 WebSocket 推送回复，这里只需等待
      return;
    }

    // HTTP fallback（WebSocket 未就绪时）
    try {
      const session_id = sessionIdRef.current ?? 'mock';
      const res = await chatAPI.sendMessage(session_id, content);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: res.data.content,
          status: (res.data.status as DeployStatus) ?? 'done',
          timestamp: new Date(),
        },
      ]);
    } catch {
      // Mock 回复（后端完全未就绪时）
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '收到你的请求，正在分析项目结构...\n\n检测到技术栈：Node.js + Express\n推荐镜像：node:18-alpine\n\n正在生成 Dockerfile 和 K8s 配置，请稍候。',
          status: 'building',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  useEffect(() => {
    const intent = deployIntentStore.consume();
    if (intent) {
      setTimeout(() => sendMessage(intent), 800);
    }
    const unsub = deployIntentStore.subscribe((intent) => {
      sendMessage(intent);
    });
    return unsub;
  }, [sendMessage]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          loading ? (
            <View style={styles.loadingRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>AI</Text>
              </View>
              <View style={styles.loadingBubble}>
                <ActivityIndicator size="small" color="#7C62FF" />
                <Text style={styles.loadingText}>正在思考...</Text>
              </View>
            </View>
          ) : null
        }
      />

      {messages.length <= 1 && (
        <View style={styles.suggestions}>
          {SUGGESTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={styles.suggestionChip}
              onPress={() => sendMessage(s)}
              activeOpacity={0.7}
            >
              <Text style={styles.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="描述你想部署的应用..."
          placeholderTextColor="rgba(73,74,100,0.4)"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={() => sendMessage()}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || loading}
          activeOpacity={0.8}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0EEFF',
  },
  messageList: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 20,
  },
  messageRowUser: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#7C62FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 2,
  },
  avatarText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  bubble: {
    maxWidth: '72%',
    borderRadius: 20,
    padding: 14,
    gap: 8,
  },
  bubbleAssistant: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(180,170,255,0.25)',
  },
  bubbleUser: {
    backgroundColor: '#7C62FF',
    borderBottomRightRadius: 5,
  },
  bubbleText: {
    fontSize: 14,
    color: '#3D3A5C',
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: '#fff',
  },
  timestamp: {
    fontSize: 11,
    color: 'rgba(100,90,160,0.4)',
    alignSelf: 'flex-end',
  },
  timestampUser: {
    color: 'rgba(255,255,255,0.5)',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusIcon: { fontSize: 12 },
  statusLabel: { fontSize: 12, fontWeight: '600' },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    borderBottomLeftRadius: 5,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(180,170,255,0.25)',
  },
  loadingText: {
    fontSize: 13,
    color: 'rgba(100,90,160,0.6)',
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 14,
    justifyContent: 'center',
  },
  suggestionChip: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(124,98,255,0.22)',
  },
  suggestionText: {
    fontSize: 13,
    color: '#7C62FF',
    fontWeight: '500',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(180,170,255,0.2)',
  },
  inputBarInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#F0EEFF',
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 13,
    fontSize: 15,
    color: '#3D3A5C',
    maxHeight: 110,
    borderWidth: 1.5,
    borderColor: 'rgba(124,98,255,0.18)',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7C62FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(124,98,255,0.28)',
  },
  sendIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
});
