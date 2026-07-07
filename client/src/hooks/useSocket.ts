import { useEffect } from 'react';
import { socketService } from '../services/socket';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { MessageRecord } from '../types';

export function useSocket() {
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const { addMessage, updateMessage, updateReactions, setTyping, updateReadBy, updateUserOnlineStatus, activeConversationId, clearUnread, incrementUnread } = useChatStore();

  useEffect(() => {
    if (!token || !user) return;

    socketService.connect(token);

    const onNewMessage = (message: MessageRecord) => {
      addMessage(message);
      if (message.senderId !== user.id) {
        if (message.conversationId === activeConversationId) {
          socketService.markRead(message.conversationId);
        } else {
          incrementUnread(message.conversationId);
        }
      }
    };

    const onMessageUpdated = (update: any) => {
      updateMessage(update.id, {
        encryptedContent: update.encryptedContent,
        nonce: update.nonce,
        isEdited: update.isEdited,
        isDeleted: update.isDeleted,
        content: update.isDeleted ? '[unsaid 💨]' : undefined,
        updatedAt: update.updatedAt,
      });
    };

    const onReactionUpdated = ({ messageId, reactions }: any) => {
      updateReactions(messageId, reactions);
    };

    const onUserTyping = ({ userId, username, conversationId }: any) => {
      if (userId !== user.id) setTyping(conversationId, userId, username, true);
    };

    const onUserStoppedTyping = ({ userId, conversationId }: any) => {
      setTyping(conversationId, userId, '', false);
    };

    const onUserStatus = ({ userId, isOnline, lastSeen }: any) => {
      updateUserOnlineStatus(userId, isOnline, lastSeen);
    };

    const onMessagesRead = ({ conversationId, userId: readerId, messageIds }: any) => {
      if (readerId !== user.id) updateReadBy(conversationId, readerId, messageIds);
      if (readerId === user.id) clearUnread(conversationId);
    };

    socketService.on('new_message', onNewMessage);
    socketService.on('message_updated', onMessageUpdated);
    socketService.on('message_reaction_updated', onReactionUpdated);
    socketService.on('user_typing', onUserTyping);
    socketService.on('user_stopped_typing', onUserStoppedTyping);
    socketService.on('user_status', onUserStatus);
    socketService.on('messages_read', onMessagesRead);

    return () => {
      socketService.off('new_message', onNewMessage);
      socketService.off('message_updated', onMessageUpdated);
      socketService.off('message_reaction_updated', onReactionUpdated);
      socketService.off('user_typing', onUserTyping);
      socketService.off('user_stopped_typing', onUserStoppedTyping);
      socketService.off('user_status', onUserStatus);
      socketService.off('messages_read', onMessagesRead);
    };
  }, [token, user?.id]);

  useEffect(() => {
    return () => { socketService.disconnect(); };
  }, []);

  return socketService;
}
