import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useChatStore } from './store/chatStore';
import { useUIStore } from './store/uiStore';
import { useSocket } from './hooks/useSocket';
import AuthPage from './components/auth/AuthPage';
import Sidebar from './components/layout/Sidebar';
import ChatArea from './components/chat/ChatArea';
import ProfileModal from './components/profile/ProfileModal';
import './styles/globals.css';

function ConvRoute() {
  const { id } = useParams<{ id: string }>();
  const { setActiveConversation } = useChatStore();
  useEffect(() => { if (id) setActiveConversation(id); return () => { setActiveConversation(null); }; }, [id]);
  return null;
}

function AppShell() {
  const user = useAuthStore(s => s.user);
  const keyPair = useAuthStore(s => s.keyPair);
  const setKeyPair = useChatStore(s => s.setKeyPair);
  const isDarkMode = useUIStore(s => s.isDarkMode);

  useSocket();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => { setKeyPair(keyPair); }, [keyPair]);

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="main-layout">
      <Sidebar />
      <ChatArea />
      <ProfileModal />
    </div>
  );
}

export default function App() {
  const isDarkMode = useUIStore(s => s.isDarkMode);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<AppShell />} />
        <Route path="/c/:id" element={<AppShell />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
