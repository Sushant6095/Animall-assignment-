'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  SessionState,
  SessionStatus,
  SessionTickData,
  SessionStartedData,
  SessionPausedData,
  SessionResumedData,
  SessionStoppedData,
  SessionStateData,
  ErrorData,
} from '../types/socket-events';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  sessionState: SessionState;
  startSession: (userId: string) => void;
  pauseSession: (userId: string) => void;
  resumeSession: (userId: string) => void;
  stopSession: (userId: string) => void;
  syncSession: (userId: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

// WebSocket server URL (defaults to localhost:3001)
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

/**
 * WebSocket context provider
 * Manages Socket.IO connection, session state, and provides session control functions
 */
export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>({
    status: 'idle',
    elapsedTime: 0,
    userId: null,
    startTime: null,
  });
  const reconnectAttempted = useRef(false);

  // Initialize socket connection
  useEffect(() => {
    const userId = localStorage.getItem('userId') || 'user123'; // Default userId for demo
    
    const newSocket = io(WS_URL, {
      query: { userId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      reconnectionDelayMax: 5000,
    });

    // Connection event
    newSocket.on('connect', () => {
      console.log('WebSocket connected:', newSocket.id);
      setIsConnected(true);
      reconnectAttempted.current = false;
      
      // Auto-sync on connect/reconnect
      if (userId) {
        newSocket.emit('SESSION_SYNC', { userId });
      }
    });

    // Disconnection event
    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    // Reconnection event
    newSocket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      
      // Emit SESSION_SYNC on reconnect
      if (userId && !reconnectAttempted.current) {
        reconnectAttempted.current = true;
        newSocket.emit('SESSION_SYNC', { userId });
      }
    });

    // Session events
    newSocket.on('SESSION_STARTED', (data: SessionStartedData) => {
      console.log('Session started:', data);
      setSessionState({
        status: 'active',
        elapsedTime: data.elapsedTime,
        userId: data.userId,
        startTime: data.startTime,
      });
    });

    newSocket.on('SESSION_TICK', (data: SessionTickData) => {
      // Update elapsed time from server (only source of truth)
      setSessionState((prev) => ({
        ...prev,
        elapsedTime: data.elapsedTime,
        status: data.status === 'active' ? 'active' : prev.status,
      }));
    });

    newSocket.on('SESSION_PAUSED', (data: SessionPausedData) => {
      console.log('Session paused:', data);
      setSessionState((prev) => ({
        ...prev,
        status: 'paused',
        elapsedTime: data.elapsedTime,
      }));
    });

    newSocket.on('SESSION_RESUMED', (data: SessionResumedData) => {
      console.log('Session resumed:', data);
      setSessionState((prev) => ({
        ...prev,
        status: 'active',
        elapsedTime: data.elapsedTime,
      }));
    });

    newSocket.on('SESSION_STOPPED', (data: SessionStoppedData) => {
      console.log('Session stopped:', data);
      setSessionState({
        status: 'stopped',
        elapsedTime: data.totalElapsedTime,
        userId: data.userId,
        startTime: null,
      });
    });

    newSocket.on('SESSION_STATE', (data: SessionStateData) => {
      console.log('Session state received:', data);
      setSessionState({
        status: data.status === 'active' ? 'active' : data.status === 'paused' ? 'paused' : 'idle',
        elapsedTime: data.elapsedTime,
        userId: data.userId,
        startTime: data.startTime,
      });
    });

    // Error event
    newSocket.on('error', (data: ErrorData) => {
      console.error('WebSocket error:', data);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, []);

  // Session control functions
  const startSession = useCallback((userId: string) => {
    if (socket && isConnected) {
      socket.emit('SESSION_START', { userId });
      localStorage.setItem('userId', userId);
    }
  }, [socket, isConnected]);

  const pauseSession = useCallback((userId: string) => {
    if (socket && isConnected) {
      socket.emit('SESSION_PAUSE', { userId });
    }
  }, [socket, isConnected]);

  const resumeSession = useCallback((userId: string) => {
    if (socket && isConnected) {
      socket.emit('SESSION_RESUME', { userId });
    }
  }, [socket, isConnected]);

  const stopSession = useCallback((userId: string) => {
    if (socket && isConnected) {
      socket.emit('SESSION_STOP', { userId });
    }
  }, [socket, isConnected]);

  const syncSession = useCallback((userId: string) => {
    if (socket && isConnected) {
      socket.emit('SESSION_SYNC', { userId });
    }
  }, [socket, isConnected]);

  return (
    <WebSocketContext.Provider
      value={{
        socket,
        isConnected,
        sessionState,
        startSession,
        pauseSession,
        resumeSession,
        stopSession,
        syncSession,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
