import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { socketService } from '../../services/socket';
import { messagesApi } from '../../services/api';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import Avatar from '../ui/Avatar';
import { MessageRecord, ConversationRecord } from '../../types';

function getConvName(conv: ConversationRecord, currentUserId: string): string {
  if (conv.type === 'group') return conv.name ?? 'Group Chat';
  const other = conv.participants.find(p => p.id !== currentUserId);
  return other?.username ?? 'Unknown';
}

function getConvStatus(conv: ConversationRecord, currentUserId: string): string {
  if (conv.type === 'group') return `${conv.participants.length} blabbers`;
  const other = conv.participants.find(p => p.id !== currentUserId);
  if (!other) return '';
  if (other.isOnline) return 'Actively Yapping 🟢';
  const d = new Date(other.lastSeen * 1000);
  return `Last caught yapping at ${d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
}

function getConvAvatar(conv: ConversationRecord, currentUserId: string): { color: string; name: string } {
  if (conv.type === 'group') return { color: '#7CFF6B', name: conv.name ?? 'G' };
  const other = conv.participants.find(p => p.id !== currentUserId);
  return { color: other?.avatarColor ?? '#FF6B9D', name: other?.username ?? '?' };
}

export default function ChatArea() {
  const { activeConversationId, conversations, messages, typingUsers, loadMessages, clearUnread } = useChatStore();
  const { user } = useAuthStore();
  const [replyTo, setReplyTo] = useState<MessageRecord | null>(null);
  const [editMessage, setEditMessage] = useState<MessageRecord | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wasAtBottom = useRef(true);

  const conv = conversations.find(c => c.id === activeConversationId);
  const convMessages = activeConversationId ? (messages[activeConversationId] ?? []) : [];
  const typingList = activeConversationId ? (typingUsers[activeConversationId] ?? []) : [];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const checkAtBottom = () => {
    const el = containerRef.current;
    if (!el) return;
    wasAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  useEffect(() => {
    if (!activeConversationId || !conv) return;
    setHasMore(true);
    loadMessages(activeConversationId).then(() => scrollToBottom());
    socketService.joinConversation(activeConversationId);
    socketService.markRead(activeConversationId);
    clearUnread(activeConversationId);
    setReplyTo(null); setEditMessage(null);
    return () => { socketService.leaveConversation(activeConversationId); };
  }, [activeConversationId]);

  useEffect(() => {
    if (wasAtBottom.current) scrollToBottom();
  }, [convMessages.length]);

  const loadMore = async () => {
    if (!activeConversationId || convMessages.length === 0 || isLoadingMore) return;
    setIsLoadingMore(true);
    const oldest = convMessages[0];
    try {
      const data = await messagesApi.getMessages(activeConversationId, oldest.createdAt, 50);
      if (data.messages.length < 50) setHasMore(false);
      if (data.messages.length === 0) { setHasMore(false); setIsLoadingMore(false); return; }
      useChatStore.setState(s => ({
        messages: {
          ...s.messages,
          [activeConversationId]: [...data.messages, ...(s.messages[activeConversationId] ?? [])],
        }
      }));
    } finally { setIsLoadingMore(false); }
  };

  if (!conv || !user) {
    return (
      <div className="chat-area">
        <div className="empty-state">
          <div className="empty-state-emoji">🦉</div>
          <div className="empty-state-title">No gossip yet.</div>
          <div className="empty-state-subtitle">We're disappointed too. Pick a Gossip Session on the left or start a Fresh Tea ☕</div>
        </div>
      </div>
    );
  }

  const avatar = getConvAvatar(conv, user.id);
  const otherUser = conv.type === 'direct' ? conv.participants.find(p => p.id !== user.id) : undefined;

  return (
    <div className="chat-area">
      <div className="chat-header">
        <Avatar color={avatar.color} username={avatar.name} size="md" isOnline={otherUser?.isOnline} />
        <div className="chat-header-info">
          <div className="chat-header-name">{getConvName(conv, user.id)}</div>
          <div className="chat-header-status">
            {otherUser?.isOnline
              ? <><span className="online">●</span> Actively Yapping</>
              : getConvStatus(conv, user.id)
            }
          </div>
        </div>
      </div>

      <div className="messages-container" ref={containerRef} onScroll={checkAtBottom}>
        {hasMore && convMessages.length >= 50 && (
          <button className="load-more-btn" onClick={loadMore} disabled={isLoadingMore}>
            {isLoadingMore ? 'Loading...' : 'Load older gossip ↑'}
          </button>
        )}

        {convMessages.length === 0 && (
          <div className="empty-state" style={{ flex: 'unset', paddingTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <div style={{ color: 'var(--text-muted)' }}>No gossip yet. We're disappointed too.</div>
          </div>
        )}

        {convMessages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isGroup={conv.type === 'group'}
            currentUser={user}
            participants={conv.participants}
            onReply={setReplyTo}
            onEdit={setEditMessage}
          />
        ))}

        <TypingIndicator users={typingList.filter(u => u.userId !== user.id)} />
        <div ref={messagesEndRef} />
      </div>

      <MessageInput
        conversation={conv}
        replyTo={replyTo}
        editMessage={editMessage}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => setEditMessage(null)}
        onMessageSent={scrollToBottom}
      />
    </div>
  );
}
