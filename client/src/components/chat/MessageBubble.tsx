import React, { useState, useRef } from 'react';
import { MessageRecord, UserPublic } from '../../types';
import Avatar from '../ui/Avatar';
import { messagesApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';

const EMOJIS = ['👍','❤️','😂','😮','😢','😡','🎉','🔥','👏','🙌','💯','🤔'];

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;
  return `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
}

interface Props {
  message: MessageRecord;
  isGroup: boolean;
  currentUser: UserPublic;
  onReply?: (message: MessageRecord) => void;
  onEdit?: (message: MessageRecord) => void;
  participants: UserPublic[];
}

const MessageBubble = React.memo(({ message, isGroup, currentUser, onReply, onEdit, participants }: Props) => {
  const isSent = message.senderId === currentUser.id;
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const { updateMessage, updateReactions } = useChatStore();

  const handleDelete = async () => {
    if (!window.confirm('Unsay that tragedy? This cannot be undone.')) return;
    try {
      await messagesApi.delete(message.id);
    } catch (e: any) { alert(e.message); }
  };

  const handleReact = async (emoji: string) => {
    setShowEmojiPicker(false);
    try {
      const data = await messagesApi.react(message.id, emoji);
      updateReactions(message.id, data.reactions);
    } catch { /* ignore */ }
  };

  const myReactions = message.reactions.filter(r => r.userId === currentUser.id).map(r => r.emoji);
  const reactionGroups = message.reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  const sender = participants.find(p => p.id === message.senderId);

  return (
    <div className={`message-wrapper ${isSent ? 'sent' : 'received'}`}>
      {/* Sender name for groups */}
      {isGroup && !isSent && sender && (
        <div className="message-sender-name">{sender.username}</div>
      )}

      <div className="message-row">
        {!isSent && sender && isGroup && (
          <Avatar color={sender.avatarColor} username={sender.username} size="sm" />
        )}

        <div style={{ position: 'relative', flex: 1 }}>
          {/* Action bar */}
          <div className="message-actions">
            <button className="action-btn" onClick={() => setShowEmojiPicker(v => !v)} title="React">😊</button>
            {onReply && <button className="action-btn" onClick={() => onReply(message)} title="Reply">↩</button>}
            {isSent && !message.isDeleted && onEdit && (
              <button className="action-btn" onClick={() => onEdit(message)} title="Edit">✏️</button>
            )}
            {isSent && !message.isDeleted && (
              <button className="action-btn danger" onClick={handleDelete} title="Unsay">🗑</button>
            )}
          </div>

          {showEmojiPicker && (
            <div ref={emojiRef} className="emoji-picker" style={{ position: 'absolute', bottom: '110%', zIndex: 50, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 8 }}>
              {EMOJIS.map(e => (
                <button key={e} className="emoji-opt" onClick={() => handleReact(e)}>{e}</button>
              ))}
            </div>
          )}

          <div className={`message-bubble ${isSent ? 'sent' : 'received'} ${message.isDeleted ? 'deleted' : ''}`}>
            {message.content ?? message.encryptedContent}
          </div>
        </div>
      </div>

      {/* Reactions */}
      {Object.keys(reactionGroups).length > 0 && (
        <div className="reaction-bar">
          {Object.entries(reactionGroups).map(([emoji, count]) => (
            <button
              key={emoji}
              className={`reaction-chip ${myReactions.includes(emoji) ? 'mine' : ''}`}
              onClick={() => handleReact(emoji)}
            >
              {emoji} <span className="reaction-count">{count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="message-meta">
        <span className="message-time">{formatTime(message.createdAt)}</span>
        {message.isEdited && !message.isDeleted && <span className="message-edited">(edited)</span>}
        {isSent && message.readBy.length > (isGroup ? 0 : 0) && (
          <span className="message-read">✓✓</span>
        )}
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';
export default MessageBubble;
