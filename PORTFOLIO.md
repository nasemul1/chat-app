# 📱 Anonymous Chat Backend - Portfolio Project

## Project Overview

**Name:** Anonymous Chat Backend  
**Repository:** [nasemul1/chat-app](https://github.com/nasemul1/chat-app)  
**Type:** Real-time Group Chat Service  
**Status:** Production-Ready  

### Brief Description

A scalable, production-ready real-time group chat service that enables anonymous users to create and join chat rooms with instant message delivery and active user tracking. Users authenticate with just a username (no password registration) and receive a session token for subsequent requests.

---

## 🛠️ Tech Stack

### Backend Framework
- **NestJS** (v10.3.0) - Enterprise-grade TypeScript framework with built-in dependency injection, modular architecture, and decorators
- **Node.js 22.x** - Runtime environment
- **TypeScript** (v5.3.3) - Type-safe development with ES2020 target
- **Express.js** - HTTP server (via NestJS platform-express)

### Database & ORM
- **PostgreSQL** - Relational database for persistent storage (users, rooms, messages)
- **Drizzle ORM** (v0.29.1) - Lightweight, type-safe ORM with zero runtime overhead
- **Drizzle-kit** - Schema migrations and push commands

### Real-time Communication
- **Socket.io** (v10.3.0) - WebSocket library for real-time bidirectional communication
- **@socket.io/redis-adapter** (v8.2.1) - Enables cross-instance message distribution

### Caching & Session Management
- **Redis** (ioredis v5.3.2) - In-memory data store for:
  - Session token storage with TTL
  - Active user tracking per room
  - Pub/Sub for multi-instance scalability

### Frontend
- **EJS** (v5.0.2, 25.6% of codebase) - Templating engine for server-side rendering
- **CSS** (18.3% of codebase) - Styling
- **Scalar API Reference** - Interactive API documentation UI (theme: kepler)

### Development & Quality Tools
- **Jest** - Unit testing framework with coverage reporting
- **ESLint & Prettier** - Code linting and formatting
- **Supertest** - HTTP assertion library for API testing
- **ts-jest, ts-loader** - TypeScript test and build support

### Language Composition
| Language   | Percentage |
|-----------|-----------|
| TypeScript | 56.1%     |
| EJS       | 25.6%     |
| CSS       | 18.3%     |

---

## 🏗️ Architecture Overview

### Design Patterns
- **Modular NestJS Architecture** - Feature-based module organization
- **Separation of Concerns** - Controllers, services, gateways, and DTOs
- **Custom Redis Socket.io Adapter** - Cross-instance WebSocket communication
- **Global Error Handling** - Centralized exception filtering and response envelope
- **Dependency Injection** - NestJS built-in DI for loose coupling

### Project Structure

```
src/
├── auth/              # Authentication module
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   └── dto/           # Data transfer objects
├── rooms/             # Rooms management module
│   ├── rooms.module.ts
│   ├── rooms.service.ts
│   ├── rooms.controller.ts
│   └── dto/
├── messages/          # Messages module
│   ├── messages.module.ts
│   ├── messages.service.ts
│   ├── messages.controller.ts
│   └── dto/
├── chat/              # WebSocket gateway
│   ├── chat.module.ts
│   ├── chat.gateway.ts  # Socket.io event handlers
│   └── services/
├── database/          # Database layer
│   ├── database.module.ts
│   ├── database.service.ts
│   ├── schema.ts      # Drizzle schema
│   └── migrations/
├── redis/             # Redis integration
│   ├── redis.module.ts
│   ├── redis.service.ts
│   └── redis.io-adapter.ts  # Custom Socket.io adapter
├── frontend/          # Frontend module
│   ├── frontend.module.ts
│   ├── frontend.controller.ts
│   └── views/         # EJS templates
├── common/            # Shared utilities
│   ├── interceptors/
│   │   └── transform.interceptor.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── exceptions/    # Custom exceptions
│   └── utils/         # Helper functions
├── app.module.ts      # Root application module
└── main.ts            # Application bootstrap
```

---

## ✨ Key Features

### 1. Anonymous Authentication ✅
- Username-only login (no passwords or registration)
- Session tokens with 24-hour TTL
- Secure token validation on all protected routes
- Redis-backed session storage

### 2. Real-time Chat ✅
- Bidirectional WebSocket communication via Socket.io
- Active user tracking per room
- Room join/leave notifications with real-time updates
- Graceful disconnection handling

### 3. Scalable Architecture ✅
- Redis pub/sub for multi-instance message distribution
- Socket.io Redis adapter for cross-server communication
- Horizontal scaling ready (tested for multiple instances)
- Zero downtime deployment support

### 4. Message Management ✅
- Cursor-based pagination for efficient message history retrieval
- Message content validation (max 1000 characters)
- Persistent storage in PostgreSQL with CASCADE deletes
- Automatic timestamps on all messages

### 5. Room Management ✅
- Create/join/leave rooms dynamically
- Room ownership (creator can delete)
- Unique room names with conflict detection
- Cascading delete (messages deleted when room deleted)

### 6. API Documentation ✅
- Swagger/OpenAPI spec generation
- Interactive Scalar reference UI at `/reference`
- Comprehensive endpoint documentation
- Bearer token authentication schema

---

## 🔌 API Endpoints

### Base Path
All endpoints use `/api/v1` as the base path.

### Authentication

**POST** `/login`
```json
Request: {
  "username": "ali_123"
}

Response: {
  "success": true,
  "data": {
    "sessionToken": "hex_token_string",
    "user": {
      "id": "user_id",
      "username": "ali_123",
      "createdAt": "2025-05-09T10:30:00Z"
    }
  }
}
```

### Rooms

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/rooms` | List all rooms |
| POST | `/rooms` | Create a new room |
| GET | `/rooms/:id` | Get room details |
| DELETE | `/rooms/:id` | Delete room (creator only) |

### Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/rooms/:id/messages` | Get paginated message history |
| POST | `/rooms/:id/messages` | Send a message |

**Query Parameters for Messages History:**
- `limit` - Number of messages to retrieve (default: 20)
- `before` - Cursor ID for pagination

### WebSocket Connection

**Connection URL:**
```
ws://localhost:3000/chat?token=<sessionToken>&roomId=<roomId>
```

**Server Events:**
- `room:joined` - User connected to room
- `room:user_joined` - Another user joined
- `message:new` - New message in room
- `room:user_left` - User left or disconnected
- `room:deleted` - Room was deleted

**Client Events:**
- `room:leave` - Graceful disconnect

---

## 💾 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### Rooms Table
```sql
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### Messages Table
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

---

## 🚀 Development Workflow

### Prerequisites
- **Node.js** >= 18.x
- **npm** >= 9.x
- **Docker & Docker Compose** (for PostgreSQL and Redis)

### Local Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/nasemul1/chat-app.git
cd chat-app
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Start PostgreSQL and Redis
```bash
docker-compose up -d
```

This starts:
- PostgreSQL on `localhost:5432` (user: postgres, password: postgres)
- Redis on `localhost:6379`

#### 4. Configure Environment Variables
```bash
cp .env.example .env
```

The `.env` file contains:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `PORT` - Server port (default: 3000)
- `SESSION_TOKEN_EXPIRY` - Session TTL in seconds (default: 86400 = 24 hours)

#### 5. Run Database Migrations
```bash
npx drizzle-kit push:pg
```

This creates the required tables: `users`, `rooms`, and `messages`.

#### 6. Start the Application

**Development mode** (with hot reload):
```bash
npm run start:dev
```

**Production mode**:
```bash
npm run build
npm run start:prod
```

The server will start on `http://localhost:3000`

### Available Commands

```bash
npm run start:dev       # Start with hot reload
npm run build           # Build for production
npm run start:prod      # Run production build
npm run lint            # Run ESLint (with auto-fix)
npm run format          # Format code with Prettier
npm test                # Run test suite
npm test:watch         # Watch mode for tests
npm test:cov           # Coverage report
```

---

## 📊 API Response Format

All responses follow a consistent envelope structure:

### Success Response (2xx)
```json
{
  "success": true,
  "data": {
    /* response payload */
  }
}
```

### Error Response (4xx, 5xx)
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `UNAUTHORIZED` | 401 | Missing or expired token |
| `FORBIDDEN` | 403 | Access denied |
| `ROOM_NOT_FOUND` | 404 | Room doesn't exist |
| `ROOM_NAME_TAKEN` | 409 | Room name already exists |
| `MESSAGE_TOO_LONG` | 422 | Message exceeds 1000 characters |

---

## 🎯 Deployment

### Render Quick Deploy

1. Push code to GitHub
2. Create new Web Service on Render
3. Connect repository
4. Set environment variables:
   - `DATABASE_URL`
   - `REDIS_URL`
   - `PORT`
   - `SESSION_TOKEN_EXPIRY`
5. Deploy

### Docker Support

The project includes Docker support for PostgreSQL and Redis via `docker-compose.yml`. The application is ready for containerization in production environments.

---

## 🎓 Portfolio Highlights

### Why This Project Stands Out

#### 1. Production-Ready Architecture
- Modular, scalable design using NestJS best practices
- Multi-instance support via Redis pub/sub
- Type-safe end-to-end with TypeScript
- Enterprise-grade error handling and validation

#### 2. Real-time Capabilities
- Socket.io WebSocket implementation with binary support
- Redis pub/sub for horizontal scaling
- Active user presence tracking
- Graceful connection management

#### 3. Full-Stack Development
- **Backend:** NestJS, PostgreSQL, Redis, Socket.io
- **Frontend:** EJS templates with CSS styling
- **DevOps:** Docker, environment configuration, migrations

#### 4. Best Practices Implementation
- Global error handling & consistent response envelopes
- Input validation with class-validator
- Cursor-based pagination for performance
- Proper database constraints (CASCADE deletes)
- Comprehensive API documentation (Swagger + Scalar UI)
- Type-safe ORM (Drizzle) for database operations

#### 5. Testing & Code Quality
- Jest unit testing framework configured
- ESLint & Prettier for code consistency
- HTTP assertion with Supertest
- Type-safe development with strict TypeScript

---

## 💬 Key Talking Points for Interviews

- **Scalability:** "Built a horizontally-scalable real-time chat platform using NestJS and Redis that handles multi-instance message distribution via pub/sub, enabling seamless scaling without downtime."

- **Real-time Communication:** "Implemented Socket.io WebSocket integration with a custom Redis adapter to ensure message delivery across multiple server instances in distributed environments."

- **Performance:** "Designed cursor-based pagination for efficient message history retrieval and Redis-backed session management to optimize database queries and reduce latency."

- **Type Safety:** "Leveraged TypeScript's strict mode and Drizzle ORM for end-to-end type safety, catching errors at compile time rather than runtime."

- **API Design:** "Created a well-documented REST API with consistent response envelopes, comprehensive error handling, and interactive Swagger/Scalar documentation for developer experience."

- **Database Design:** "Modeled relational schema with PostgreSQL including proper foreign key constraints and CASCADE deletes for data integrity."

---

## 📝 Testing

Run the test suite:

```bash
npm test                # Run all tests once
npm test:watch         # Watch mode for development
npm test:cov           # Generate coverage report
```

---

## 📄 License

ISC

---

## 🤝 Contributing

1. Create a feature branch
2. Make changes
3. Run linting and tests
4. Submit a pull request

---

## 📞 Support

For issues or questions, please open a [GitHub issue](https://github.com/nasemul1/chat-app/issues).

---

**Last Updated:** May 9, 2026