import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function AuthPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { login, register, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const validate = () => {
    const e: Record<string, string> = {};
    if (tab === 'register') {
      if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username))
        e.username = 'Username: 3-20 chars, letters/numbers/underscores only';
      if (password !== confirmPassword) e.confirmPassword = "Passwords don't match. Did you forget already?";
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Valid email required';
    if (!password || password.length < 8) e.password = 'Min 8 characters. Security is not a joke.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    if (!validate()) return;
    try {
      if (tab === 'login') { await login(email, password); }
      else { await register(username, email, password); }
      navigate('/');
    } catch { /* error shown from store */ }
  };

  const switchTab = (t: 'login' | 'register') => {
    setTab(t); clearError(); setErrors({});
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="auth-owl">🦉</span>
        <div className="auth-logo"><span className="auth-logo-text">BLABBERBOX</span></div>
        <p className="auth-tagline">Where gossip meets encryption — chat away, worry-free!</p>

        <div className="auth-tabs">
          <button className={`auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => switchTab('login')}>
            Resume Yapping
          </button>
          <button className={`auth-tab${tab === 'register' ? ' active' : ''}`} onClick={() => switchTab('register')}>
            Join the Club
          </button>
        </div>

        {error && <div className="form-error-global">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          {tab === 'register' && (
            <div className="form-group">
              <label className="form-label">Your Blabber Name</label>
              <input
                className={`input-field${errors.username ? ' error' : ''}`}
                type="text"
                placeholder="coolblabber42"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
              />
              {errors.username && <p className="form-error">{errors.username}</p>}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className={`input-field${errors.email ? ' error' : ''}`}
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
            {errors.email && <p className="form-error">{errors.email}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className={`input-field${errors.password ? ' error' : ''}`}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
            {errors.password && <p className="form-error">{errors.password}</p>}
          </div>
          {tab === 'register' && (
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                className={`input-field${errors.confirmPassword ? ' error' : ''}`}
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              {errors.confirmPassword && <p className="form-error">{errors.confirmPassword}</p>}
            </div>
          )}
          <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }} disabled={isLoading}>
            {isLoading ? (
              <><span className="spinner" /> {tab === 'login' ? 'Logging in...' : 'Creating account...'}</>
            ) : (
              tab === 'login' ? 'Resume Yapping 🚀' : 'Join the Blabber Club 🦉'
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 20 }}>
          🔒 Your messages are end-to-end encrypted. Even we can't read them.
        </p>
      </div>
    </div>
  );
}
