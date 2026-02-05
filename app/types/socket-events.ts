/**
 * Typed event interfaces for WebSocket communication (Client-side)
 */

export interface SessionStartData {
  userId: string;
}

export interface SessionPauseData {
  userId: string;
}

export interface SessionResumeData {
  userId: string;
}

export interface SessionStopData {
  userId: string;
}

export interface SessionSyncData {
  userId: string;
}

export interface SessionStartedData {
  userId: string;
  startTime: number;
  elapsedTime: number;
}

export interface SessionTickData {
  userId: string;
  elapsedTime: number;
  status: string;
}

export interface SessionPausedData {
  userId: string;
  elapsedTime: number;
}

export interface SessionResumedData {
  userId: string;
  elapsedTime: number;
}

export interface SessionStoppedData {
  userId: string;
  totalElapsedTime: number;
}

export interface SessionSyncResponseData {
  userId: string;
  elapsedTime: number;
  status: string;
  startTime: number;
}

export interface SessionStateData {
  userId: string;
  elapsedTime: number;
  status: string;
  startTime: number;
  lastUpdateTime: number;
}

export interface ErrorData {
  message: string;
  code?: string;
}

export interface ConnectedData {
  socketId: string;
  timestamp: number;
}

export type SessionStatus = 'idle' | 'active' | 'paused' | 'stopped';

export interface SessionState {
  status: SessionStatus;
  elapsedTime: number;
  userId: string | null;
  startTime: number | null;
}
