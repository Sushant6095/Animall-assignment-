'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import CowIcon from './CowIcon';
import GrassDecoration from './GrassDecoration';
import styles from './MilkingSession.module.css';

const DEFAULT_USER_ID = 'user123';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SessionHistory {
  id: string;
  userId: string;
  startTime: string;
  endTime: string;
  duration: number;
  elapsedTime: number;
  pausedTime: number;
  createdAt: string;
}

/**
 * Milking Session UI Component
 * - Displays timer (driven by WebSocket SESSION_TICK events)
 * - Provides Start/Pause/Resume/Stop controls
 * - Syncs music playback with session state
 * - Disables invalid actions based on current state
 * - Displays session history
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
  const [sessionHistory, setSessionHistory] = useState<SessionHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  
  // Music files configuration
  const musicFiles = [
    { id: 'cow1', name: 'Cow Music 1', path: '/music/cow-music-1.mp3' },
    { id: 'cow2', name: 'Cow Music 2', path: '/music/cow-music-2.mp3' },
    { id: 'cow3', name: 'Cow Music 3', path: '/music/cow-music-3.mp3' },
    { id: 'cow4', name: 'Cow Music 4', path: '/music/cow-music-4.mp3' },
  ];
  
  const [selectedMusic, setSelectedMusic] = useState<string>(() => {
    // Load from localStorage or default to first music
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('selectedMusic');
      return saved || musicFiles[0].id;
    }
    return musicFiles[0].id;
  });

  // Get current music file path
  const getCurrentMusicPath = () => {
    const music = musicFiles.find(m => m.id === selectedMusic);
    return music?.path || musicFiles[0].path;
  };

  // Initialize audio element
  useEffect(() => {
    const musicPath = getCurrentMusicPath();
    const audio = new Audio(musicPath);
    audio.loop = true;
    audio.volume = 0.5;
    audio.preload = 'auto';
    
    // Add error handler to check if file exists
    audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      console.error('Failed to load music file:', musicPath);
      console.error('Make sure the file exists at:', musicPath);
    });
    
    // Add load handler
    audio.addEventListener('loadeddata', () => {
      console.log('Audio loaded successfully:', musicPath);
    });
    
    audioRef.current = audio;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('error', () => {});
        audioRef.current.removeEventListener('loadeddata', () => {});
        audioRef.current = null;
      }
    };
  }, [selectedMusic]);

  // Handle music selection change
  const handleMusicChange = (musicId: string) => {
    if (isMusicPlaying && audioRef.current) {
      // Stop current music
      audioRef.current.pause();
      setIsMusicPlaying(false);
    }
    
    setSelectedMusic(musicId);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('selectedMusic', musicId);
    }
    
    // If session is active, start new music
    if (sessionState.status === 'active') {
      setTimeout(async () => {
        const musicPath = musicFiles.find(m => m.id === musicId)?.path || musicFiles[0].path;
        const newAudio = new Audio(musicPath);
        newAudio.loop = true;
        newAudio.volume = 0.5;
        newAudio.preload = 'auto';
        
        // Wait for audio to load
        try {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
            newAudio.addEventListener('canplay', () => {
              clearTimeout(timeout);
              resolve(true);
            }, { once: true });
            newAudio.addEventListener('error', () => {
              clearTimeout(timeout);
              reject(new Error('Load error'));
            }, { once: true });
            newAudio.load();
          });
          
          audioRef.current = newAudio;
          await newAudio.play();
          setIsMusicPlaying(true);
        } catch (error) {
          console.error('Error loading/playing new music:', error);
        }
      }, 100);
    }
  };

  // Sync music playback with session state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (sessionState.status === 'active' && !isMusicPlaying) {
      // Wait for audio to be ready before playing
      const playAudio = async () => {
        try {
          // If audio is not loaded, wait for it
          if (audio.readyState < 2) {
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Audio load timeout'));
              }, 5000);
              
              audio.addEventListener('canplay', () => {
                clearTimeout(timeout);
                resolve(true);
              }, { once: true });
              
              audio.addEventListener('error', () => {
                clearTimeout(timeout);
                reject(new Error('Audio load error'));
              }, { once: true });
              
              // Try to load
              audio.load();
            });
          }
          
          await audio.play();
          setIsMusicPlaying(true);
          console.log('Music started playing');
        } catch (error) {
          console.error('Error playing music:', error);
          console.error('This might be due to browser autoplay restrictions. Try clicking Start again.');
          // Music autoplay might be blocked by browser - user interaction required
        }
      };
      
      playAudio();
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

  // Format date and time
  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Fetch session history from API
  const fetchSessionHistory = useCallback(async () => {
    if (!userId) {
      setHistoryError('User ID is required');
      setIsLoadingHistory(false);
      return;
    }
    
    setIsLoadingHistory(true);
    setHistoryError(null);
    
    try {
      const url = `${API_BASE_URL}/sessions?userId=${encodeURIComponent(userId)}`;
      console.log('Fetching session history from:', url);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Session history data:', data);
        const sessions = data.sessions || [];
        setSessionHistory(sessions);
        
        if (sessions.length === 0) {
          setHistoryError(null); // No error, just no data
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || `Server error (${response.status})`;
        console.error('Failed to fetch session history:', response.status, errorMessage);
        setHistoryError(`Failed to load history: ${errorMessage}`);
        setSessionHistory([]);
      }
    } catch (error) {
      console.error('Error fetching session history:', error);
      let errorMessage = 'Unable to connect to server';
      
      if (error instanceof Error && error.name === 'AbortError') {
        errorMessage = `Request timed out. The server at ${API_BASE_URL} may be unavailable or slow to respond.`;
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = `Cannot connect to backend at ${API_BASE_URL}. Make sure the backend server is running on port 3001.`;
      } else if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
      }
      
      setHistoryError(errorMessage);
      setSessionHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [userId]);

  // Fetch history on mount and when userId changes
  useEffect(() => {
    if (userId) {
      fetchSessionHistory();
    }
  }, [userId, fetchSessionHistory]);

  // Fetch history when session stops
  useEffect(() => {
    if (sessionState.status === 'stopped') {
      // Small delay to ensure backend has persisted the session
      const timeoutId = setTimeout(() => {
        fetchSessionHistory();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [sessionState.status, fetchSessionHistory]);

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

  const handleToggleHistory = () => {
    setShowHistory(!showHistory);
    if (!showHistory && sessionHistory.length === 0) {
      fetchSessionHistory();
    }
  };

  // Determine which buttons should be enabled
  const canStart = sessionState.status === 'idle' || sessionState.status === 'stopped';
  const canPause = sessionState.status === 'active';
  const canResume = sessionState.status === 'paused';
  const canStop = sessionState.status === 'active' || sessionState.status === 'paused';

  // Determine cow animation state
  const cowAnimationClass = 
    sessionState.status === 'active' ? styles.active :
    sessionState.status === 'paused' ? styles.paused : '';

  return (
    <div className={styles.container}>
      <GrassDecoration />
      
      {/* History Side Panel */}
      <div className={`${styles.sidePanel} ${showHistory ? styles.sidePanelOpen : ''}`}>
        <div className={styles.sidePanelContent}>
          <div className={styles.sidePanelHeader}>
            <h2 className={styles.sidePanelTitle}>📊 Session History</h2>
            <button
              onClick={handleToggleHistory}
              className={styles.sidePanelClose}
              aria-label="Close history panel"
              title="Close"
            >
              ✕
            </button>
          </div>
          
          <div className={styles.sidePanelBody}>
            {isLoadingHistory ? (
              <div className={styles.loading}>Loading history...</div>
            ) : historyError ? (
              <div className={styles.errorMessage}>
                <p>{historyError}</p>
                <button
                  onClick={fetchSessionHistory}
                  className={styles.retryButton}
                >
                  Retry
                </button>
              </div>
            ) : sessionHistory.length === 0 ? (
              <div className={styles.emptyHistory}>
                <p>No session history found for user: <strong>{userId}</strong></p>
                <p className={styles.emptyHint}>Complete a milking session to see it here!</p>
              </div>
            ) : (
              <div className={styles.historyList}>
                {sessionHistory.map((session) => (
                  <div key={session.id} className={styles.historyItem}>
                    <div className={styles.historyItemHeader}>
                      <span className={styles.historyDate}>
                        {formatDateTime(session.startTime)}
                      </span>
                      <span className={styles.historyDuration}>
                        {formatTime(session.elapsedTime)}
                      </span>
                    </div>
                    <div className={styles.historyItemDetails}>
                      <div className={styles.historyDetail}>
                        <span className={styles.historyLabel}>Duration:</span>
                        <span>{formatTime(session.duration)}</span>
                      </div>
                      {session.pausedTime > 0 && (
                        <div className={styles.historyDetail}>
                          <span className={styles.historyLabel}>Paused:</span>
                          <span>{formatTime(session.pausedTime)}</span>
                        </div>
                      )}
                      <div className={styles.historyDetail}>
                        <span className={styles.historyLabel}>Ended:</span>
                        <span>{formatDateTime(session.endTime)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className={styles.sidePanelFooter}>
            <button
              onClick={fetchSessionHistory}
              disabled={isLoadingHistory}
              className={styles.refreshButton}
              aria-label="Refresh history"
              title="Refresh history"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>
      
      {/* Overlay when side panel is open */}
      {showHistory && (
        <div 
          className={styles.overlay}
          onClick={handleToggleHistory}
          aria-label="Close history panel"
        />
      )}
      
      <div className={styles.header}>
        <div className={`${styles.cowContainer} ${cowAnimationClass}`}>
          <CowIcon size={100} animated={sessionState.status === 'active'} />
        </div>
        <h1>🐄 Milking Session</h1>
        <p className={styles.headerSubtitle}>Track your milking sessions with precision</p>
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

      {/* Music Selection and Status */}
      <div className={styles.musicSection}>
        <div className={styles.musicSelector}>
          <label htmlFor="musicSelect" className={styles.musicLabel}>
            🎵 Select Music:
          </label>
          <select
            id="musicSelect"
            value={selectedMusic}
            onChange={(e) => handleMusicChange(e.target.value)}
            className={styles.musicSelect}
            disabled={sessionState.status === 'active'}
          >
            {musicFiles.map((music) => (
              <option key={music.id} value={music.id}>
                {music.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.musicStatus}>
          <span>Music: {isMusicPlaying ? '▶ Playing' : '⏸ Stopped'}</span>
        </div>
      </div>

      {/* History Toggle Button - Fixed position */}
      <button
        onClick={handleToggleHistory}
        className={styles.historyToggle}
        aria-label="Toggle session history"
        title="View session history"
      >
        📊 History
      </button>
    </div>
  );
}
