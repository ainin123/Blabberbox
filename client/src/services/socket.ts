import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private typingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private isTyping: Map<string, boolean> = new Map();

  connect(token: string): void {
    if (this.socket?.connected) return;
    // Connect to same host as page — Vite proxies /socket.io → localhost:3001
    // This works for both localhost and LAN/ngrok access
    const serverUrl = window.location.origin;
    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.typingTimers.forEach(t => clearTimeout(t));
    this.typingTimers.clear();
    this.isTyping.clear();
  }

  joinConversation(id: string): void {
    this.socket?.emit('join_conversation', id);
  }

  leaveConversation(id: string): void {
    this.socket?.emit('leave_conversation', id);
  }

  startTyping(conversationId: string): void {
    if (!this.isTyping.get(conversationId)) {
      this.socket?.emit('typing_start', conversationId);
      this.isTyping.set(conversationId, true);
    }
    const existing = this.typingTimers.get(conversationId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.stopTyping(conversationId);
    }, 3000);
    this.typingTimers.set(conversationId, timer);
  }

  stopTyping(conversationId: string): void {
    if (this.isTyping.get(conversationId)) {
      this.socket?.emit('typing_stop', conversationId);
      this.isTyping.set(conversationId, false);
    }
    const timer = this.typingTimers.get(conversationId);
    if (timer) { clearTimeout(timer); this.typingTimers.delete(conversationId); }
  }

  markRead(conversationId: string): void {
    this.socket?.emit('mark_read', conversationId);
  }

  on(event: string, handler: (...args: any[]) => void): void {
    this.socket?.on(event, handler);
  }

  off(event: string, handler: (...args: any[]) => void): void {
    this.socket?.off(event, handler);
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  get socketInstance(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();
