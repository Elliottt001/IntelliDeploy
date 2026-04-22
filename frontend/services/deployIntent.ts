/**
 * 部署意图共享状态
 * Gallery 点击"一键部署"后写入，Chat 页面读取并自动发送
 */

type Listener = (intent: string) => void;

class DeployIntentStore {
  private intent: string | null = null;
  private listeners: Listener[] = [];

  set(intent: string) {
    this.intent = intent;
    this.listeners.forEach((fn) => fn(intent));
  }

  consume(): string | null {
    const val = this.intent;
    this.intent = null;
    return val;
  }

  subscribe(fn: Listener) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }
}

export const deployIntentStore = new DeployIntentStore();
