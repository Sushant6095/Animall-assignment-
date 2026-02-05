/**
 * Typed event interfaces for WebSocket communication
 */

/**
 * Client-to-server events
 */
export interface ClientToServerEvents {
  // Session events
  'SESSION_START': (data: SessionStartData) => void;
  'SESSION_PAUSE': (data: SessionPauseData) => void;
  'SESSION_RESUME': (data: SessionResumeData) => void;
  'SESSION_STOP': (data: SessionStopData) => void;
  'SESSION_SYNC': (data: SessionSyncData) => void;
  
  // Ping/pong for connection health
  'ping': () => void;
}

/**
 * Server-to-client events
 */
export interface ServerToClientEvents {
  // Session events
  'SESSION_STARTED': (data: SessionStartedData) => void;
  'SESSION_PAUSED': (data: SessionPausedData) => void;
  'SESSION_RESUMED': (data: SessionResumedData) => void;
  'SESSION_STOPPED': (data: SessionStoppedData) => void;
  'SESSION_TICK': (data: SessionTickData) => void;
  'SESSION_SYNC': (data: SessionSyncResponseData) => void;
  'SESSION_STATE': (data: SessionStateData) => void;
  
  // Error events
  'error': (data: ErrorData) => void;
  
  // Connection events
  'connected': (data: ConnectedData) => void;
  
  // Pong response
  'pong': () => void;
}

/**
 * Inter-server events (for scaling)
 */
export interface InterServerEvents {
  // Reserved for future use
}

/**
 * Socket data payloads
 */
export interface SocketData {
  userId?: string;
}

/**
 * Event data types
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
