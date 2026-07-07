import { useState, useRef, FormEvent, KeyboardEvent, useEffect } from 'react';
import { MessageRecord, ConversationRecord } from '../../types';
import { messagesApi } from '../../services/api';
import { cryptoService } from '../../services/crypto';
import { useAuthStore } from '../../store/authStore';
import { socketService } from '../../services/socket';

const EMOJIS = ['😀','😂','🥰','😎','🤔','😴','🤩','🥳','😭','😡','🙄','👀','👍','❤️','🔥','🎉','💀','🦉','🤫','💬','✨','🚀'];

interface Props {
  conversation: ConversationRecord;
  replyTo?: MessageRecord | null;
  editMessage?: MessageRecord | null;
  onCancelReply?: () => void;
  onCancelEdit?: () => void;
  onMessageSent?: () => void;
}

export default function MessageInput({ conversation, replyTo, editMessage, onCancelReply, onCancelEdit, onMessageSent }: Props) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { keyPair, user } = useAuthStore();

  useEffect(() => {
    if (editMessage) { setText(editMessage.content ?? ''); textareaRef.current?.focus(); }
    else setText('');
  }, [editMessage]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const getEncryptedPayload = (content: string) => {
    if (!keyPair) return null;
    if (conversation.type === 'group') {
      let groupKey = localStorage.getItem(`blabberbox_gk_${conversation.id}`);
      if (!groupKey) {
        groupKey = cryptoService.generateGroupKey();
        localStorage.setItem(`blabberbox_gk_${conversation.id}`, groupKey);
      }
      return cryptoService.encryptGroupMessage(content, groupKey);
    }
    // DM: find the other participant
    const recipient = conversation.participants.find(p => p.id !== user?.id);
    if (!recipient) return null;
    // For own messages (loopback test), encrypt to self
    const recipientKey = recipient.id === user?.id ? keyPair.publicKey : recipient.publicKey;
    return cryptoService.encryptMessage(content, recipientKey, keyPair.privateKey);
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    try {
      if (editMessage) {
        const payload = getEncryptedPayload(trimmed);
        if (!payload) { alert('Encryption failed. Cannot send.'); setIsSending(false); return; }
        await messagesApi.edit(editMessage.id, payload.encryptedContent, payload.nonce);
        onCancelEdit?.();
      } else {
        const payload = getEncryptedPayload(trimmed);
        if (!payload) { alert('Encryption not ready. Are you logged in?'); setIsSending(false); return; }
        await messagesApi.send(conversation.id, payload.encryptedContent, payload.nonce, replyTo?.id);
        onCancelReply?.();
        onMessageSent?.();
      }
      setText('');
      if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
      socketService.stopTyping(conversation.id);
    } catch (e: any) {
      alert(e.message ?? 'Failed to send. Our hamsters are tired.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    autoResize();
    if (e.target.value.trim()) socketService.startTyping(conversation.id);
    else socketService.stopTyping(conversation.id);
  };

  const insertEmoji = (emoji: string) => {
    setText(t => t + emoji);
    setShowEmojis(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="message-input-area">
      {editMessage && (
        <div className="edit-bar">
          <span>✏️ Editing message</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 13 }}>{editMessage.content}</span>
          <button className="btn-icon" onClick={onCancelEdit} style={{ fontSize: 18 }}>×</button>
        </div>
      )}
      {replyTo && !editMessage && (
        <div className="reply-bar">
          <span>↩ Replying to</span>
          <span className="reply-bar-text">{replyTo.content ?? '[encrypted]'}</span>
          <button className="reply-close" onClick={onCancelReply}>×</button>
        </div>
      )}

      <div className="input-row" style={{ position: 'relative' }}>
        <button className="emoji-trigger" onClick={() => setShowEmojis(v => !v)} type="button" title="Emojis">😊</button>

        {showEmojis && (
          <div className="emoji-picker-popup">
            {EMOJIS.map(e => (
              <button key={e} className="emoji-opt" onClick={() => insertEmoji(e)}>{e}</button>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="message-textarea"
          placeholder={editMessage ? 'Edit your blabber...' : 'Drop the truth bomb... (Enter to send, Shift+Enter for new line)'}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
        />

        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!text.trim() || isSending}
          title={editMessage ? 'Save changes' : 'Blurt it out'}
        >
          {isSending ? <span className="spinner" style={{ borderTopColor: 'white', width: 18, height: 18 }} /> : (editMessage ? '✓' : '➤')}
        </button>
      </div>
    </div>
  );
}
