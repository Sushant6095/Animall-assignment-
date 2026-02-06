# 🐄 Milking Session Tracker

A real-time milking session tracking application built with Next.js, Node.js, Socket.IO, Redis, and PostgreSQL. This application allows users to track milking sessions with precise timing, pause/resume functionality, and session history.

## 📋 Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Data Flow Diagrams](#data-flow-diagrams)
- [Tech Stack & Rationale](#tech-stack--rationale)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [API Documentation](#api-documentation)
- [Environment Variables](#environment-variables)

## ✨ Features

- **Real-time Session Tracking**: Live timer updates via WebSocket
- **Session Controls**: Start, Pause, Resume, and Stop sessions
- **Session History**: View past milking sessions with detailed statistics
- **Multi-user Support**: Each user has isolated sessions
- **Music Integration**: Background music during active sessions
- **Graceful Degradation**: Works even if Redis or Database is unavailable
- **Session Recovery**: Automatic session recovery on reconnection

## 🏗️ Architecture Overview

The application follows a **three-tier architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React Components (MilkingSession, WebSocketContext) │   │
│  └──────────────────────────────────────────────────────┘   │
│                         ↕ WebSocket                          │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Node.js/Express)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Socket.IO    │  │ REST API     │  │ Session      │     │
│  │ Server       │  │ Routes       │  │ Timer        │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         ↕                  ↕                    ↕          │
└─────────────────────────────────────────────────────────────┘
         ↕                  ↕                    ↕
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                               │
│  ┌──────────────┐              ┌──────────────┐           │
│  │   Redis      │              │  PostgreSQL   │           │
│  │ (Active      │              │  (Permanent  │           │
│  │  Sessions)   │              │   History)   │           │
│  └──────────────┘              └──────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```mermaid
graph TB
    A[User Browser] -->|HTTP/WebSocket| B[Next.js Frontend]
    B -->|WebSocket| C[Socket.IO Server]
    B -->|REST API| D[Express Routes]
    
    C -->|Session Operations| E[Session Handlers]
    E -->|Read/Write| F[Redis Cache]
    E -->|Timer Updates| C
    C -->|Real-time Events| B
    
    D -->|Query History| G[Prisma ORM]
    G -->|Read| H[PostgreSQL]
    
    E -->|Persist Completed| I[Session Persistence]
    I -->|Write| G
    
    F -->|Fallback| J[In-Memory Storage]
    
    style A fill:#e1f5ff
    style B fill:#c8e6c9
    style C fill:#fff9c4
    style D fill:#fff9c4
    style E fill:#ffccbc
    style F fill:#f8bbd0
    style G fill:#e1bee7
    style H fill:#b2dfdb
    style I fill:#ffccbc
    style J fill:#d1c4e9
```

## 📊 Data Flow Diagrams

### 1. Session Start Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant WS as WebSocket Server
    participant SH as Session Handler
    participant R as Redis
    participant T as Timer
    participant DB as PostgreSQL

    U->>F: Click "Start"
    F->>WS: SESSION_START (userId)
    WS->>SH: handleSessionStart()
    SH->>R: Acquire Lock (userId)
    SH->>R: Check Existing Session
    alt Session Exists
        SH->>WS: Error Response
        WS->>F: Error Event
    else No Session
        SH->>R: Create Session (TTL: 1hr)
        SH->>T: Start Timer (userId)
        SH->>WS: SESSION_STARTED Event
        WS->>F: SESSION_STARTED
        F->>U: Update UI (Timer starts)
        T->>R: Update Elapsed Time (every 1s)
        T->>WS: SESSION_TICK (every 1s)
        WS->>F: SESSION_TICK
        F->>U: Update Timer Display
    end
```

### 2. Session Stop & Persistence Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant WS as WebSocket Server
    participant SH as Session Handler
    participant R as Redis
    participant SP as Session Persistence
    participant DB as PostgreSQL
    participant API as REST API

    U->>F: Click "Stop"
    F->>WS: SESSION_STOP (userId)
    WS->>SH: handleSessionStop()
    SH->>R: Get Session Data
    SH->>T: Stop Timer
    SH->>SP: Persist Session
    SP->>DB: Check Existing (idempotency)
    alt Session Exists
        SP->>SP: Return Existing ID
    else New Session
        SP->>DB: Create MilkingSession Record
        DB->>SP: Return Session ID
    end
    SP->>R: Delete Active Session
    SH->>WS: SESSION_STOPPED Event
    WS->>F: SESSION_STOPPED
    F->>API: GET /sessions?userId=...
    API->>DB: Query Sessions
    DB->>API: Return History
    API->>F: Session History JSON
    F->>U: Display Updated History
```

### 3. Session History Retrieval Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant API as REST API
    participant R as Redis Cache
    participant DB as PostgreSQL

    U->>F: Click "Show History"
    F->>API: GET /sessions?userId=...
    API->>R: Check Cache (history:userId)
    alt Cache Hit
        R->>API: Return Cached Data
        API->>F: Return History (cached: true)
    else Cache Miss
        API->>DB: Query MilkingSession WHERE userId
        DB->>API: Return Sessions (sorted by startTime DESC)
        API->>R: Cache Result (TTL: 5min)
        API->>F: Return History (cached: false)
    end
    F->>U: Display Session History
```

### 4. Reconnection & Session Recovery Flow

```mermaid
sequenceDiagram
    participant F as Frontend
    participant WS as WebSocket Server
    participant SH as Session Handler
    participant R as Redis

    Note over F,R: User disconnects (network issue)
    F->>WS: Disconnect Event
    WS->>SH: Unregister Socket
    
    Note over F,R: User reconnects
    F->>WS: Connect (with userId in query)
    WS->>SH: recoverSessionOnReconnect()
    SH->>R: Get Active Session (userId)
    alt Active Session Exists
        R->>SH: Return Session Data
        SH->>T: Resume Timer (if ACTIVE)
        SH->>WS: SESSION_STATE Event
        WS->>F: SESSION_STATE (with current elapsedTime)
        F->>F: Sync UI State
    else No Active Session
        SH->>WS: No Session to Recover
        WS->>F: Connection Confirmed
    end
```

## 🛠️ Tech Stack & Rationale

### Frontend

#### **Next.js 14**
- **Why**: Server-side rendering, optimized performance, built-in routing, and excellent developer experience
- **Benefits**: 
  - Fast page loads with SSR/SSG
  - Automatic code splitting
  - Built-in API routes (though we use separate backend)
  - Excellent TypeScript support

#### **React 18**
- **Why**: Industry standard, component-based architecture, large ecosystem
- **Benefits**: 
  - Reusable components
  - Hooks for state management
  - Virtual DOM for efficient updates

#### **Socket.IO Client**
- **Why**: Real-time bidirectional communication with automatic reconnection
- **Benefits**: 
  - Automatic fallback to polling if WebSocket fails
  - Built-in reconnection logic
  - Event-based architecture
  - Cross-browser compatibility

### Backend

#### **Node.js + Express**
- **Why**: JavaScript ecosystem consistency, non-blocking I/O, excellent for real-time applications
- **Benefits**: 
  - Single language (JavaScript/TypeScript) across stack
  - High concurrency for WebSocket connections
  - Rich ecosystem of packages
  - Fast development cycle

#### **TypeScript**
- **Why**: Type safety, better IDE support, catch errors at compile time
- **Benefits**: 
  - Reduced runtime errors
  - Better code documentation
  - Easier refactoring
  - Improved developer experience

#### **Socket.IO Server**
- **Why**: Real-time communication, room management, automatic scaling support
- **Benefits**: 
  - Handles WebSocket + polling fallback
  - Built-in room/namespace support
  - Automatic reconnection handling
  - Cross-origin support

### Data Storage

#### **Redis** ⭐ Key Choice
- **Why**: 
  1. **Performance**: Sub-millisecond latency for read/write operations
  2. **TTL Support**: Automatic expiration of active sessions (1 hour default)
  3. **Distributed Locking**: Prevents race conditions with `SET NX` operations
  4. **Caching**: Fast retrieval of session history (5-minute cache)
  5. **In-Memory Storage**: Perfect for temporary, frequently accessed data
  6. **Scalability**: Can be used as a shared state store across multiple server instances

- **Use Cases in This App**:
  - Active session storage (`session:{userId}`)
  - Session locks (`lock:milking:{userId}`)
  - History caching (`history:{userId}`)
  - TTL-based auto-cleanup

- **Fallback Strategy**: In-memory Map when Redis is unavailable (ensures app continues working)

#### **PostgreSQL + Prisma**
- **Why**: 
  1. **Reliability**: ACID compliance for permanent data storage
  2. **Relationships**: Easy to extend with user profiles, farms, etc.
  3. **Prisma ORM**: Type-safe database access, migrations, excellent DX
  4. **Query Performance**: Indexed queries for fast history retrieval
  5. **Data Integrity**: Unique constraints prevent duplicate sessions

- **Use Cases in This App**:
  - Permanent session history storage
  - User session analytics
  - Data persistence across server restarts

### Additional Tools

#### **Prisma**
- **Why**: Type-safe database client, migrations, schema management
- **Benefits**: 
  - Auto-generated TypeScript types
  - Database migrations
  - Query builder with type safety
  - Database introspection

## 📁 Project Structure

```
animall2-assignment/
├── app/                          # Next.js frontend
│   ├── components/               # React components
│   │   ├── MilkingSession.tsx   # Main session UI
│   │   ├── CowIcon.tsx          # Animated cow icon
│   │   └── GrassDecoration.tsx  # Background decoration
│   ├── contexts/                 # React contexts
│   │   └── WebSocketContext.tsx # WebSocket state management
│   ├── types/                    # TypeScript types
│   │   └── socket-events.ts      # Socket event definitions
│   ├── page.tsx                 # Home page
│   └── layout.tsx               # Root layout
│
├── src/                          # Backend server
│   ├── socket/                   # WebSocket handlers
│   │   ├── socket-handler.ts    # Socket.IO initialization
│   │   ├── session-handlers.ts # Session event handlers
│   │   └── session-timer.ts    # Timer management
│   ├── routes/                   # REST API routes
│   │   ├── index.ts             # Route registration
│   │   ├── sessions.ts          # Session history API
│   │   └── health.ts            # Health check
│   ├── utils/                    # Utility functions
│   │   ├── redis.ts             # Redis client & operations
│   │   ├── prisma.ts            # Prisma client
│   │   ├── session-storage.ts  # Session CRUD operations
│   │   ├── session-lock.ts     # Distributed locking
│   │   └── session-persistence.ts # DB persistence
│   ├── constants/                # Constants
│   │   └── redis-keys.ts        # Redis key patterns
│   ├── config/                   # Configuration
│   │   └── env.ts               # Environment variables
│   ├── types/                    # TypeScript types
│   │   └── socket-events.ts     # Socket event types
│   ├── app.ts                   # Express app setup
│   └── server.ts                # Server entry point
│
├── prisma/                       # Database schema
│   ├── schema.prisma            # Prisma schema
│   └── migrations/              # Database migrations
│
├── public/                       # Static assets
│   └── music/                   # Background music files
│
├── package.json                 # Dependencies
├── tsconfig.json                # TypeScript config
└── README.md                    # This file
```

## 🚀 Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+
- Redis 6+ (optional, app works with in-memory fallback)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd animall2-assignment
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/milking_db"
   
   # Redis (optional - app works without it)
   REDIS_URL="redis://localhost:6379"
   REDIS_HOST="localhost"
   REDIS_PORT=6379
   REDIS_PASSWORD=""
   
   # Server
   PORT=3001
   NODE_ENV=development
   
   # Frontend (for Next.js)
   NEXT_PUBLIC_API_URL="http://localhost:3001"
   NEXT_PUBLIC_WS_URL="http://localhost:3001"
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run prisma:generate
   
   # Run migrations
   npm run prisma:migrate
   ```

5. **Start Redis** (optional)
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:latest
   
   # Or using local Redis installation
   redis-server
   ```

6. **Start the backend server**
   ```bash
   npm run dev
   ```
   Server runs on `http://localhost:3001`

7. **Start the frontend** (in a new terminal)
   ```bash
   npm run dev:next
   ```
   Frontend runs on `http://localhost:3002`

8. **Open the application**
   Navigate to `http://localhost:3002` in your browser

## 📡 API Documentation

### REST API Endpoints

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1234567890
}
```

#### `GET /sessions?userId={userId}`
Fetch session history for a user.

**Query Parameters:**
- `userId` (required): User ID to fetch sessions for

**Response:**
```json
{
  "userId": "user123",
  "sessions": [
    {
      "id": "uuid",
      "userId": "user123",
      "startTime": "2024-01-01T10:00:00Z",
      "endTime": "2024-01-01T10:15:00Z",
      "duration": 900,
      "elapsedTime": 900,
      "pausedTime": 0,
      "createdAt": "2024-01-01T10:15:00Z"
    }
  ],
  "cached": false
}
```

### WebSocket Events

#### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `SESSION_START` | `{ userId: string }` | Start a new session |
| `SESSION_PAUSE` | `{ userId: string }` | Pause active session |
| `SESSION_RESUME` | `{ userId: string }` | Resume paused session |
| `SESSION_STOP` | `{ userId: string }` | Stop active session |
| `SESSION_SYNC` | `{ userId: string }` | Sync session state |

#### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `SESSION_STARTED` | `{ userId, startTime, elapsedTime }` | Session started |
| `SESSION_PAUSED` | `{ userId, elapsedTime }` | Session paused |
| `SESSION_RESUMED` | `{ userId, elapsedTime }` | Session resumed |
| `SESSION_STOPPED` | `{ userId, elapsedTime }` | Session stopped |
| `SESSION_TICK` | `{ userId, elapsedTime, status }` | Timer update (every 1s) |
| `SESSION_STATE` | `{ userId, elapsedTime, status, startTime }` | Current session state |
| `error` | `{ message, code }` | Error occurred |

## 🔧 Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` | No |
| `REDIS_HOST` | Redis host | `localhost` | No |
| `REDIS_PORT` | Redis port | `6379` | No |
| `REDIS_PASSWORD` | Redis password | - | No |
| `PORT` | Backend server port | `3001` | No |
| `NODE_ENV` | Environment (development/production) | `development` | No |
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:3001` | No |
| `NEXT_PUBLIC_WS_URL` | WebSocket server URL | `http://localhost:3001` | No |

## 🎯 Key Design Decisions

### 1. **Redis for Active Sessions**
- Active sessions are temporary and need fast access
- TTL ensures automatic cleanup of abandoned sessions
- Distributed locking prevents race conditions
- Can scale horizontally with Redis cluster

### 2. **PostgreSQL for History**
- Permanent storage with ACID guarantees
- Easy to query and analyze historical data
- Can add relationships (users, farms, animals) later
- Prisma provides type safety and migrations

### 3. **Graceful Degradation**
- App works without Redis (in-memory fallback)
- App works without Database (sessions work, history doesn't persist)
- Prevents single points of failure

### 4. **Idempotency**
- Unique constraint on `(userId, startTime)` prevents duplicates
- Session persistence checks for existing records before creating

### 5. **Real-time Updates**
- Server-driven timer ensures accuracy
- WebSocket ticks every second for smooth UI updates
- Client can't manipulate timer (security)

## 🧪 Testing

```bash
# Type checking
npm run type-check

# Lint frontend
npm run lint:next

# Build for production
npm run build
npm run build:next
```

## 📝 License

ISC

## 👥 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

**Built with ❤️ for efficient milking session tracking**
