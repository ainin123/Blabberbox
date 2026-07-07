import { create } from 'zustand';
import { ConversationRecord, MessageRecord } from '../types';
import { conversationsApi, messagesApi } from '../services/api';
import { cryptoService } from '../services/crypto';

function decryptMsg(msg: MessageRecord, keyPair: { publicKey: string; privateKey: string } | null, conversations: ConversationRecord[]): MessageRecord {
  if (msg.isDeleted) return { ...msg, content: '[unsaid 💨]' };
  if (!keyPair) return { ...msg, content: '[🔒 No key on this device]' };
  if (!msg.encryptedContent || !msg.nonce) return { ...msg, content: msg.encryptedContent };

  const conv = conversations.find(c => c.id === msg.conversationId);
  if (!conv) return { ...msg, content: '[Decryption failed 🔒]' };

  if (conv.type === 'group') {
    const groupKey = localStorage.getItem(`blabberbox_gk_${msg.conversationId}`);
    if (!groupKey) return { ...msg, content: '[🔒 Group key not available]' };
    const decrypted = cryptoService.decryptGroupMessage(msg.encryptedContent, msg.nonce, groupKey);
    return { ...msg, content: decrypted ?? '[Decryption failed 🔒]' };
  }

  const sender = conv.participants.find(p => p.id === msg.senderId);
  if (!sender) return { ...msg, content: '[Decryption failed 🔒]' };

  // If I sent it, use my own public key (loopback for own messages)
  const senderPublicKey = sender.publicKey;
  const decrypted = cryptoService.decryptMessage(msg.encryptedContent, msg.nonce, senderPublicKey, keyPair.privateKey);
  return { ...msg, content: decrypted ?? '[Decryption failed 🔒]' };
}

interface ChatStore {
  conversations: ConversationRecord[];
  activeConversationId: string | null;
  messages: Record<string, MessageRecord[]>;
  typingUsers: Record<string, Array<{ userId: string; username: string }>>;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  keyPair: { publicKey: string; privateKey: string } | null;

  setKeyPair: (kp: { publicKey: string; privateKey: string } | null) => void;
  loadConversations: () => Promise<void>;
  setActiveConversation: (id: string | null) => void;
  loadMessages: (conversationId: string) => Promise<void>;
  addMessage: (message: MessageRecord) => void;
  updateMessage: (id: string, update: Partial<MessageRecord>) => void;
  addConversation: (conv: ConversationRecord) => void;
  updateConversationLastMessage: (conversationId: string, message: MessageRecord) => void;
  setTyping: (conversationId: string, userId: string, username: string, isTyping: boolean) => void;
  incrementUnread: (conversationId: string) => void;
  clearUnread: (conversationId: string) => void;
  updateReactions: (messageId: string, reactions: any[]) => void;
  updateReadBy: (conversationId: string, userId: string, messageIds: string[]) => void;
  updateUserOnlineStatus: (userId: string, isOnline: boolean, lastSeen: number) => void;
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  typingUsers: {},
  isLoadingConversations: false,
  isLoadingMessages: false,
  keyPair: null,

  setKeyPair: (kp) => set({ keyPair: kp }),

  loadConversations: async () => {
    set({ isLoadingConversations: true });
    try {
      const data = await conversationsApi.getAll();
      set({ conversations: data.conversations, isLoadingConversations: false });
    } catch {
      set({ isLoadingConversations: false });
    }
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  loadMessages: async (conversationId) => {
    set({ isLoadingMessages: true });
    try {
      const data = await messagesApi.getMessages(conversationId);
      const { keyPair, conversations } = get();
      const decrypted = data.messages.map(m => decryptMsg(m, keyPair, conversations));
      set(s => ({ messages: { ...s.messages, [conversationId]: decrypted }, isLoadingMessages: false }));
    } catch {
      set({ isLoadingMessages: false });
    }
  },

  addMessage: (message) => {
    const { keyPair, conversations } = get();
    const decrypted = decryptMsg(message, keyPair, conversations);
    set(s => {
      const existing = s.messages[message.conversationId] ?? [];
      if (existing.some(m => m.id === message.id)) return s;
      return { messages: { ...s.messages, [message.conversationId]: [...existing, decrypted] } };
    });
    get().updateConversationLastMessage(message.conversationId, decrypted);
  },

  updateMessage: (id, update) => {
    set(s => {
      const newMessages = { ...s.messages };
      for (const convId in newMessages) {
        newMessages[convId] = newMessages[convId].map(m => m.id === id ? { ...m, ...update } : m);
      }
      return { messages: newMessages };
    });
  },

  addConversation: (conv) => {
    set(s => {
      const exists = s.conversations.some(c => c.id === conv.id);
      if (exists) return s;
      return { conversations: [conv, ...s.conversations] };
    });
  },

  updateConversationLastMessage: (conversationId, message) => {
    set(s => ({
      conversations: s.conversations.map(c =>
        c.id === conversationId
          ? { ...c, lastMessage: message, unreadCount: c.id === s.activeConversationId ? 0 : c.unreadCount }
          : c
      ).sort((a, b) => (b.lastMessage?.createdAt ?? b.createdAt) - (a.lastMessage?.createdAt ?? a.createdAt)),
    }));
  },

  setTyping: (conversationId, userId, username, isTyping) => {
    set(s => {
      const current = s.typingUsers[conversationId] ?? [];
      const filtered = current.filter(u => u.userId !== userId);
      return {
        typingUsers: {
          ...s.typingUsers,
          [conversationId]: isTyping ? [...filtered, { userId, username }] : filtered,
        },
      };
    });
  },

  incrementUnread: (conversationId) => {
    set(s => ({
      conversations: s.conversations.map(c =>
        c.id === conversationId && c.id !== s.activeConversationId
          ? { ...c, unreadCount: c.unreadCount + 1 }
          : c
      ),
    }));
  },

  clearUnread: (conversationId) => {
    set(s => ({
      conversations: s.conversations.map(c => c.id === conversationId ? { ...c, unreadCount: 0 } : c),
    }));
  },

  updateReactions: (messageId, reactions) => {
    set(s => {
      const newMessages = { ...s.messages };
      for (const convId in newMessages) {
        newMessages[convId] = newMessages[convId].map(m => m.id === messageId ? { ...m, reactions } : m);
      }
      return { messages: newMessages };
    });
  },

  updateReadBy: (conversationId, userId, messageIds) => {
    set(s => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] ?? []).map(m =>
          messageIds.includes(m.id) && !m.readBy.includes(userId)
            ? { ...m, readBy: [...m.readBy, userId] }
            : m
        ),
      },
    }));
  },

  updateUserOnlineStatus: (userId, isOnline, lastSeen) => {
    set(s => ({
      conversations: s.conversations.map(c => ({
        ...c,
        participants: c.participants.map(p => p.id === userId ? { ...p, isOnline, lastSeen } : p),
      })),
    }));
  },
}));
