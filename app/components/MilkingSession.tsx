'use client';

import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import styles from './MilkingSession.module.css';

const DEFAULT_USER_ID = 'user123';

/**
 * Milking Session UI Component
 * - Displays timer (driven by WebSocket SESSION_TICK events)
 * - Provides Start/Pause/Resume/Stop controls
 * - Syncs music playback with session state
 * - Disables invalid actions based on current state
 */
export default function MilkingSession() {
  const {
    isConnected,
    sessionState,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
  } = useWebSocket();

  const [userId, setUserId] = useState(DEFAULT_USER_ID);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  // Initialize audio element
  useEffect(() => {
    // Create audio element (you can replace with actual music URL)
    const audio = new Audio('/music.mp3'); // Place your music file in public folder
    audio.loop = true;
    audio.volume = 0.5;
    audioRef.current = audio;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Sync music playback with session state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (sessionState.status === 'active' && !isMusicPlaying) {
      audio.play().catch((error) => {
        console.error('Error playing music:', error);
        // Music autoplay might be blocked by browser
      });
      setIsMusicPlaying(true);
    } else if (sessionState.status === 'paused' && isMusicPlaying) {
      audio.pause();
      setIsMusicPlaying(false);
    } else if (sessionState.status === 'stopped' && isMusicPlaying) {
      audio.pause();
      audio.currentTime = 0;
      setIsMusicPlaying(false);
    } else if (sessionState.status === 'idle' && isMusicPlaying) {
      audio.pause();
      audio.currentTime = 0;
      setIsMusicPlaying(false);
    }
  }, [sessionState.status, isMusicPlaying]);

  // Format time display (MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Button handlers
  const handleStart = () => {
    if (userId) {
      startSession(userId);
    }
  };

  const handlePause = () => {
    if (userId) {
      pauseSession(userId);
    }
  };

  const handleResume = () => {
    if (userId) {
      resumeSession(userId);
    }
  };

  const handleStop = () => {
    if (userId) {
      stopSession(userId);
    }
  };

  // Determine which buttons should be enabled
  const canStart = sessionState.status === 'idle' || sessionState.status === 'stopped';
  const canPause = sessionState.status === 'active';
  const canResume = sessionState.status === 'paused';
  const canStop = sessionState.status === 'active' || sessionState.status === 'paused';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Milking Session</h1>
        <div className={styles.connectionStatus}>
          <span className={isConnected ? styles.connected : styles.disconnected}>
            {isConnected ? '● Connected' : '○ Disconnected'}
          </span>
        </div>
      </div>

      <div className={styles.userInput}>
        <label htmlFor="userId">User ID:</label>
        <input
          id="userId"
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          disabled={sessionState.status !== 'idle' && sessionState.status !== 'stopped'}
        />
      </div>

      {/* Big Timer Display */}
      <div className={styles.timerContainer}>
        <div className={styles.timer}>
          {formatTime(sessionState.elapsedTime)}
        </div>
        <div className={styles.timerLabel}>
          {sessionState.status === 'active' && 'Running'}
          {sessionState.status === 'paused' && 'Paused'}
          {sessionState.status === 'stopped' && 'Stopped'}
          {sessionState.status === 'idle' && 'Ready'}
        </div>
      </div>

      {/* Control Buttons */}
      <div className={styles.controls}>
        <button
          onClick={handleStart}
          disabled={!canStart || !isConnected}
          className={styles.button}
          aria-label="Start session"
        >
          Start
        </button>
        <button
          onClick={handlePause}
          disabled={!canPause || !isConnected}
          className={styles.button}
          aria-label="Pause session"
        >
          Pause
        </button>
        <button
          onClick={handleResume}
          disabled={!canResume || !isConnected}
          className={styles.button}
          aria-label="Resume session"
        >
          Resume
        </button>
        <button
          onClick={handleStop}
          disabled={!canStop || !isConnected}
          className={`${styles.button} ${styles.stopButton}`}
          aria-label="Stop session"
        >
          Stop
        </button>
      </div>

      {/* Music Status */}
      <div className={styles.musicStatus}>
        <span>Music: {isMusicPlaying ? '▶ Playing' : '⏸ Stopped'}</span>
      </div>
    </div>
  );
}
