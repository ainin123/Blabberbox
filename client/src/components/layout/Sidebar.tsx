import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { conversationsApi, usersApi } from '../../services/api';
import { ConversationRecord, UserPublic } from '../../types';
import Avatar from '../ui/Avatar';
import Modal from '../ui/Modal';

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getConvName(conv: ConversationRecord, currentUserId: string): string {
  if (conv.type === 'group') return conv.name ?? 'Group';
  const other = conv.participants.find(p => p.id !== currentUserId);
  return other?.username ?? 'Unknown';
}

function getConvAvatar(conv: ConversationRecord, currentUserId: string): { color: string; name: string; isOnline?: boolean } {
  if (conv.type === 'group') return { color: '#7CFF6B', name: conv.name ?? 'G' };
  const other = conv.participants.find(p => p.id !== currentUserId);
  return { color: other?.avatarColor ?? '#FF6B9D', name: other?.username ?? '?', isOnline: other?.isOnline };
}

export default function Sidebar() {
  const navigate = useNavigate();
  const { conversations, activeConversationId, setActiveConversation, loadConversations, addConversation } = useChatStore();
  const { user } = useAuthStore();
  const { isDarkMode, toggleDarkMode, setProfileOpen, isNewChatOpen, setNewChatOpen, isGroupChatOpen, setGroupChatOpen, searchQuery, setSearchQuery } = useUIStore();

  const [newChatSearch, setNewChatSearch] = useState('');
  const [userResults, setUserResults] = useState<UserPublic[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [groupResults, setGroupResults] = useState<UserPublic[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<UserPublic[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => { loadConversations(); }, []);

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 2) { setUserResults([]); return; }
    setIsSearching(true);
    try { const data = await usersApi.search(q); setUserResults(data.users); }
    finally { setIsSearching(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchUsers(newChatSearch), 300);
    return () => clearTimeout(t);
  }, [newChatSearch]);

  useEffect(() => {
    const t = setTimeout(() => { if (groupSearch.length >= 2) usersApi.search(groupSearch).then(d => setGroupResults(d.users)); else setGroupResults([]); }, 300);
    return () => clearTimeout(t);
  }, [groupSearch]);

  const openConversation = (conv: ConversationRecord) => {
    setActiveConversation(conv.id);
    navigate(`/c/${conv.id}`);
  };

  const startDM = async (u: UserPublic) => {
    try {
      const data = await conversationsApi.create(u.id);
      addConversation(data.conversation);
      setNewChatOpen(false);
      openConversation(data.conversation);
    } catch (e: any) { alert(e.message); }
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedParticipants.length === 0) return;
    setIsCreating(true);
    try {
      const data = await conversationsApi.createGroup(groupName, selectedParticipants.map(p => p.id));
      addConversation(data.conversation);
      setGroupChatOpen(false);
      setGroupName(''); setSelectedParticipants([]);
      openConversation(data.conversation);
    } catch (e: any) { alert(e.message); }
    finally { setIsCreating(false); }
  };

  const filtered = conversations.filter(c => {
    if (!searchQuery) return true;
    const name = getConvName(c, user?.id ?? '').toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  if (!user) return null;

  return (
    <>
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">🦉 BLABBERBOX</div>
          <div className="sidebar-actions">
            <button className="btn-icon" onClick={toggleDarkMode} title={isDarkMode ? 'Light mode' : 'Dark mode'}>
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            <button className="btn-icon" onClick={() => setProfileOpen(true)} title="Silence the Haters">⚙️</button>
          </div>
        </div>

        <div className="search-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              placeholder="Search Blabbers..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="sidebar-new-chat-btns">
          <button className="btn-new-chat" onClick={() => setNewChatOpen(true)}>☕ Fresh Tea</button>
          <button className="btn-new-chat" onClick={() => setGroupChatOpen(true)}>👥 Squad Session</button>
        </div>

        <div className="conversation-list">
          {filtered.length === 0 ? (
            <div className="empty-conversations">
              <span className="emoji">🦗</span>
              <p>No gossip sessions yet.</p>
              <p style={{ fontSize: 12 }}>Start one with "Fresh Tea"!</p>
            </div>
          ) : (
            filtered.map(conv => {
              const av = getConvAvatar(conv, user.id);
              const name = getConvName(conv, user.id);
              const lastMsg = conv.lastMessage;
              const preview = lastMsg
                ? (lastMsg.isDeleted ? '[unsaid 💨]' : lastMsg.content ?? '🔒 Encrypted')
                : 'No messages yet';
              return (
                <div
                  key={conv.id}
                  className={`conversation-item${conv.id === activeConversationId ? ' active' : ''}`}
                  onClick={() => openConversation(conv)}
                >
                  <Avatar color={av.color} username={av.name} size="md" isOnline={av.isOnline} />
                  <div className="conv-info">
                    <div className="conv-name">{name}</div>
                    <div className="conv-last-msg">{preview}</div>
                  </div>
                  <div className="conv-meta">
                    {lastMsg && <span className="conv-time">{formatTime(lastMsg.createdAt)}</span>}
                    {conv.unreadCount > 0 && <span className="unread-badge">{conv.unreadCount}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* New DM Modal */}
      <Modal isOpen={isNewChatOpen} onClose={() => setNewChatOpen(false)} title="☕ Start Fresh Tea">
        <div className="modal-body">
          <input
            className="input-field"
            placeholder="Search for a Blabber..."
            value={newChatSearch}
            onChange={e => setNewChatSearch(e.target.value)}
            autoFocus
          />
          <div style={{ marginTop: 12, maxHeight: 320, overflowY: 'auto' }}>
            {isSearching && <div style={{ color: 'var(--text-muted)', padding: 16, textAlign: 'center' }}>Searching for blabbers...</div>}
            {!isSearching && newChatSearch.length >= 2 && userResults.length === 0 && (
              <div style={{ color: 'var(--text-muted)', padding: 16, textAlign: 'center' }}>No blabbers found. They're hiding.</div>
            )}
            {userResults.map(u => (
              <div key={u.id} className="user-result" onClick={() => startDM(u)}>
                <Avatar color={u.avatarColor} username={u.username} size="sm" isOnline={u.isOnline} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{u.username}</div>
                  {u.bio && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.bio}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* New Group Modal */}
      <Modal isOpen={isGroupChatOpen} onClose={() => setGroupChatOpen(false)} title="👥 Create Squad Session">
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Squad Name</label>
            <input className="input-field" placeholder="The Gossip Squad 🔥" value={groupName} onChange={e => setGroupName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Add Blabbers</label>
            <input className="input-field" placeholder="Search blabbers..." value={groupSearch} onChange={e => setGroupSearch(e.target.value)} />
          </div>
          {selectedParticipants.length > 0 && (
            <div className="selected-chips" style={{ marginBottom: 12 }}>
              {selectedParticipants.map(p => (
                <span key={p.id} className="chip">
                  {p.username}
                  <span className="chip-remove" onClick={() => setSelectedParticipants(sp => sp.filter(x => x.id !== p.id))}>×</span>
                </span>
              ))}
            </div>
          )}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {groupResults.filter(u => !selectedParticipants.some(p => p.id === u.id) && u.id !== user.id).map(u => (
              <div key={u.id} className="user-result" onClick={() => setSelectedParticipants(sp => [...sp, u])}>
                <Avatar color={u.avatarColor} username={u.username} size="sm" />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{u.username}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setGroupChatOpen(false)}>Cancel</button>
          <button className="btn btn-primary" style={{ width: 'auto' }} disabled={!groupName.trim() || selectedParticipants.length === 0 || isCreating} onClick={createGroup}>
            {isCreating ? 'Creating...' : 'Create Squad 🚀'}
          </button>
        </div>
      </Modal>
    </>
  );
}
