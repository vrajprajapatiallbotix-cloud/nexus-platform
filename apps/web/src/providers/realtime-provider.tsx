'use client';

import { createContext, useContext, useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationStore } from '@/stores/notification.store';

const RealtimeContext = createContext<Socket | null>(null);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const { accessToken } = useAuthStore();
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    if (!accessToken) return;

    const socket = io(
      `${process.env['NEXT_PUBLIC_WS_URL'] ?? 'http://localhost:4000'}/realtime`,
      { auth: { token: accessToken }, transports: ['websocket', 'polling'] },
    );

    socket.on('notification:new', (notification) => {
      addNotification(notification);
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <RealtimeContext.Provider value={socketRef.current}>
      {children}
    </RealtimeContext.Provider>
  );
}

export const useSocket = () => useContext(RealtimeContext);
