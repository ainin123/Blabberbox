import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { usersApi } from '../../services/api';
import Modal from '../ui/Modal';
import Avatar from '../ui/Avatar';

const PRESET_COLORS = ['#FF6B9D','#00B4FF','#7CFF6B','#FF9F43','#A29BFE','#FD79A8','#00CEC9','#FDCB6E','#E17055','#74B9FF'];

type Tab = 'profile' | 'blocked' | 'security';

export default function ProfileModal() {
  const { isProfileOpen, setProfileOpen, isDarkMode, toggleDarkMode } = useUIStore();
  const { user, updateUser } = useAuthStore();
  const [tab, setTab] = useState<Tab>('profile');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor ?? '#FF6B9D');
  const [readReceipts, setReadReceipts] = useState(user?.showReadReceipts ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loadedBlocked, setLoadedBlocked] = useState(false);
  const { keyPair } = useAuthStore();

  const loadBlocked = async () => {
    if (loadedBlocked) return;
    try { const data = await usersApi.getBlocked(); setBlockedUsers(data.users); setLoadedBlocked(true); }
    catch { /* ignore */ }
  };

  const handleTabChange = (t: Tab) => { setTab(t); if (t === 'blocked') loadBlocked(); };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data = await usersApi.updateProfile({ bio, avatarColor, showReadReceipts: readReceipts, darkMode: isDarkMode });
      updateUser(data.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) { alert(e.message); }
    finally { setIsSaving(false); }
  };

  const handleUnblock = async (userId: string) => {
    try {
      await usersApi.unblockUser(userId);
      setBlockedUsers(b => b.filter(u => u.id !== userId));
    } catch (e: any) { alert(e.message); }
  };

  if (!user) return null;

  return (
    <Modal isOpen={isProfileOpen} onClose={() => setProfileOpen(false)} title="⚙️ Silence the Haters">
      <div className="modal-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <Avatar color={avatarColor} username={user.username} size="xl" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{user.username}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{user.bio || 'No bio yet. Add some flair!'}</div>
          </div>
        </div>

        <div className="profile-tabs">
          {(['profile', 'blocked', 'security'] as Tab[]).map(t => (
            <button key={t} className={`profile-tab${tab === t ? ' active' : ''}`} onClick={() => handleTabChange(t)}>
              {t === 'profile' ? '👤 My Profile' : t === 'blocked' ? '🚫 Muted Fools' : '🔒 Security'}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div>
            <div className="form-group">
              <label className="form-label">Bio (tell 'em who you are)</label>
              <textarea
                className="input-field"
                style={{ minHeight: 80, resize: 'vertical' }}
                placeholder="Professional gossip connoisseur..."
                value={bio}
                onChange={e => setBio(e.target.value)}
                maxLength={200}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{bio.length}/200</div>
            </div>

            <div className="form-group">
              <label className="form-label">Avatar Color</label>
              <div className="color-grid">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    className={`color-swatch${avatarColor === c ? ' selected' : ''}`}
                    style={{ background: c }}
                    onClick={() => setAvatarColor(c)}
                    title={c}
                  />
                ))}
              </div>
            </div>

            <div className="toggle-row">
              <div>
                <div className="toggle-label">Read Receipts</div>
                <div className="toggle-desc">Let others know you read their gossip</div>
              </div>
              <button className={`toggle${readReceipts ? ' on' : ''}`} onClick={() => setReadReceipts(v => !v)} />
            </div>

            <div className="toggle-row">
              <div>
                <div className="toggle-label">Dark Mode</div>
                <div className="toggle-desc">Go full goth, we support you</div>
              </div>
              <button className={`toggle${isDarkMode ? ' on' : ''}`} onClick={toggleDarkMode} />
            </div>

            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : saved ? '✅ Saved!' : 'Save Changes'}
            </button>
          </div>
        )}

        {tab === 'blocked' && (
          <div>
            {blockedUsers.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>😇</div>
                <div>No fools muted. You're very patient.</div>
              </div>
            ) : blockedUsers.map(u => (
              <div key={u.id} className="blocked-user-row">
                <Avatar color={u.avatarColor} username={u.username} size="sm" />
                <div style={{ flex: 1, fontWeight: 600 }}>{u.username}</div>
                <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => handleUnblock(u.id)}>
                  Unmute
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'security' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Your Public Key</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Share this with no one. Your messages are encrypted using it.</div>
              <div className="key-display">{user.publicKey}</div>
              <button className="btn btn-ghost" style={{ marginTop: 8, padding: '8px 16px', fontSize: 13 }} onClick={() => navigator.clipboard.writeText(user.publicKey)}>
                📋 Copy Public Key
              </button>
            </div>

            <div style={{ marginTop: 20, padding: '16px', background: 'rgba(124,255,107,0.08)', border: '1px solid rgba(124,255,107,0.2)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 600, color: 'var(--green)', marginBottom: 6 }}>🔒 End-to-End Encrypted</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Your messages are encrypted using NaCl box encryption before leaving your device.
                Not even the server can read them. Pinky promise.
              </div>
            </div>

            {keyPair && (
              <div style={{ marginTop: 16, padding: '12px', background: 'rgba(255,107,157,0.08)', border: '1px solid rgba(255,107,157,0.2)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-muted)' }}>
                ✅ Your private key is stored securely on this device. It never leaves your browser.
              </div>
            )}

            {!keyPair && (
              <div style={{ marginTop: 16, padding: '12px', background: 'rgba(255,100,100,0.08)', border: '1px solid rgba(255,100,100,0.2)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: '#ff8080' }}>
                ⚠️ No private key found on this device. Messages may not decrypt. Try logging out and back in.
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
