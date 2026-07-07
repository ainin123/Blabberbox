import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIStore {
  isDarkMode: boolean;
  isProfileOpen: boolean;
  isNewChatOpen: boolean;
  isGroupChatOpen: boolean;
  searchQuery: string;
  toggleDarkMode: () => void;
  setProfileOpen: (open: boolean) => void;
  setNewChatOpen: (open: boolean) => void;
  setGroupChatOpen: (open: boolean) => void;
  setSearchQuery: (q: string) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      isDarkMode: true,
      isProfileOpen: false,
      isNewChatOpen: false,
      isGroupChatOpen: false,
      searchQuery: '',
      toggleDarkMode: () => set((s) => ({ isDarkMode: !s.isDarkMode })),
      setProfileOpen: (open) => set({ isProfileOpen: open }),
      setNewChatOpen: (open) => set({ isNewChatOpen: open }),
      setGroupChatOpen: (open) => set({ isGroupChatOpen: open }),
      setSearchQuery: (q) => set({ searchQuery: q }),
    }),
    { name: 'blabberbox_ui', partialize: (s) => ({ isDarkMode: s.isDarkMode }) }
  )
);
