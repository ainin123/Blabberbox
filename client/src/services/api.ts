import { ConversationRecord, MessageRecord, UserPublic } from '../types';

const BASE = '/api';

let getToken: () => string | null = () => null;
let getRefreshToken: () => string | null = () => null;
let onTokenRefreshed: (token: string) => void = () => {};
let onLogout: () => void = () => {};

export function configureApi(opts: {
  getToken: () => string | null;
  getRefreshToken: () => string | null;
  onTokenRefreshed: (token: string) => void;
  onLogout: () => void;
}) {
  getToken = opts.getToken;
  getRefreshToken = opts.getRefreshToken;
  onTokenRefreshed = opts.onTokenRefreshed;
  onLogout = opts.onLogout;
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const rt = getRefreshToken();
    if (rt) {
      try {
        const refreshRes = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          onTokenRefreshed(data.data.token);
          return request<T>(path, options, false);
        }
      } catch {
        // ignore refresh error
      }
    }
    onLogout();
    throw new Error('Session expired. Resume yapping by logging in again.');
  }

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Something went wrong. Our hamsters are tired.');
  return json.data as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
const put = <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) });
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

export const authApi = {
  register: (username: string, email: string, password: string, publicKey: string) =>
    post<{ token: string; refreshToken: string; user: UserPublic }>('/auth/register', { username, email, password, publicKey }),
  login: (email: string, password: string) =>
    post<{ token: string; refreshToken: string; user: UserPublic }>('/auth/login', { email, password }),
  refresh: (refreshToken: string) =>
    post<{ token: string }>('/auth/refresh', { refreshToken }),
  logout: () => post<void>('/auth/logout'),
  me: () => get<{ user: UserPublic }>('/auth/me'),
};

export const usersApi = {
  search: (q: string) => get<{ users: UserPublic[] }>(`/users/search?q=${encodeURIComponent(q)}`),
  getUser: (id: string) => get<{ user: UserPublic }>(`/users/${id}`),
  updateProfile: (data: { bio?: string; avatarColor?: string; showReadReceipts?: boolean; darkMode?: boolean }) =>
    put<{ user: UserPublic }>('/users/profile', data),
  blockUser: (id: string) => post<void>(`/users/${id}/block`),
  unblockUser: (id: string) => del<void>(`/users/${id}/block`),
  getBlocked: () => get<{ users: UserPublic[] }>('/users/blocked'),
};

export const conversationsApi = {
  getAll: () => get<{ conversations: ConversationRecord[] }>('/conversations'),
  create: (participantId: string) => post<{ conversation: ConversationRecord }>('/conversations', { participantId }),
  get: (id: string) => get<{ conversation: ConversationRecord }>(`/conversations/${id}`),
  createGroup: (name: string, participantIds: string[]) =>
    post<{ conversation: ConversationRecord }>('/conversations/group', { name, participantIds }),
};

export const messagesApi = {
  getMessages: (conversationId: string, before?: number, limit = 50) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set('before', String(before));
    return get<{ messages: MessageRecord[] }>(`/messages/${conversationId}?${params}`);
  },
  send: (conversationId: string, encryptedContent: string, nonce: string, parentId?: string) =>
    post<{ message: MessageRecord }>('/messages', { conversationId, encryptedContent, nonce, parentId }),
  edit: (id: string, encryptedContent: string, nonce: string) =>
    put<{ message: MessageRecord }>(`/messages/${id}`, { encryptedContent, nonce }),
  delete: (id: string) => del<void>(`/messages/${id}`),
  react: (id: string, emoji: string) =>
    post<{ reactions: any[] }>(`/messages/${id}/react`, { emoji }),
  unreact: (id: string, emoji: string) => del<void>(`/messages/${id}/react/${encodeURIComponent(emoji)}`),
  markRead: (conversationId: string) => post<void>(`/messages/${conversationId}/read`),
};
