import { create } from 'zustand';

interface AiAssistantState {
  isOpen: boolean;
  isMinimized: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  toggleMinimize: () => void;
}

export const useAiAssistantStore = create<AiAssistantState>((set) => ({
  isOpen: false,
  isMinimized: false,
  toggle: () => set((state) => ({ isOpen: !state.isOpen, isMinimized: false })),
  open: () => set({ isOpen: true, isMinimized: false }),
  close: () => set({ isOpen: false }),
  toggleMinimize: () => set((state) => ({ isMinimized: !state.isMinimized })),
}));
