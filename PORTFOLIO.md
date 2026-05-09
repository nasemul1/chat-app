# 📱 Anonymous Chat Backend - Portfolio

## Project Overview
Real-time group chat service with anonymous authentication. Users create/join rooms and exchange messages instantly via WebSocket with multi-instance scalability.

---

## 🛠️ Tech Stack

| Category | Technologies |
|----------|--------------|
| **Backend** | NestJS, TypeScript, Node.js 22 |
| **Database** | PostgreSQL, Drizzle ORM |
| **Real-time** | Socket.io, Redis pub/sub |
| **Frontend** | EJS, CSS |
| **Testing** | Jest, Supertest |
| **Tools** | ESLint, Prettier, Docker |

**Language Composition:** TypeScript (56.1%), EJS (25.6%), CSS (18.3%)

---

## 🏗️ Architecture

### Modular Structure
```
src/
├── auth/          # Session token management
├── rooms/         # Room CRUD operations
├── messages/      # Message storage & retrieval
├── chat/          # Socket.io gateway
├── database/      # Drizzle ORM setup
├── redis/         # Session & pub/sub
├── frontend/      # EJS views
└── common/        # Interceptors, filters, exceptions
```

---

## ✨ Key Features

✅ Anonymous login (username only, no password)  
✅ Real-time chat with Socket.io WebSocket  
✅ Multi-instance scaling via Redis pub/sub  
✅ Cursor-based message pagination  
✅ Active user tracking per room  
✅ Persistent storage with PostgreSQL  
✅ Swagger & Scalar API documentation  

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/login` | POST | Authenticate with username |
| `/api/v1/rooms` | GET/POST | List or create rooms |
| `/api/v1/rooms/:id` | GET/DELETE | Get or delete room |
| `/api/v1/rooms/:id/messages` | GET/POST | Message history & send |

**WebSocket:** `ws://localhost:3000/chat?token=TOKEN&roomId=ID`

---

## 💾 Database Schema

```sql
-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Rooms
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Messages (CASCADE delete)
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🚀 Quick Start

```bash
# 1. Clone & install
git clone https://github.com/nasemul1/chat-app.git
cd chat-app
npm install

# 2. Start services
docker-compose up -d

# 3. Setup
cp .env.example .env
npx drizzle-kit push:pg

# 4. Run
npm run start:dev
```

---

## 📊 Response Format

**Success:**
```json
{ "success": true, "data": { } }
```

**Error:**
```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Description" } }
```

---

## 🎯 Key Highlights

- **Scalable:** Multi-instance support via Redis pub/sub
- **Type-Safe:** End-to-end TypeScript with strict mode
- **Real-time:** Socket.io with custom Redis adapter
- **Documented:** Swagger + Scalar interactive UI
- **Production-Ready:** Error handling, validation, pagination
- **Performant:** Cursor-based pagination, Redis caching

---

## 💬 Interview Talking Points

1. "Built a horizontally-scalable real-time chat using NestJS and Redis pub/sub for cross-instance message distribution"
2. "Implemented Socket.io with custom Redis adapter for seamless multi-instance WebSocket communication"
3. "Designed type-safe ORM layer with Drizzle for PostgreSQL with CASCADE deletes"
4. "Created comprehensive API with consistent response envelopes and Swagger documentation"

---

## 📁 Repository
[nasemul1/chat-app](https://github.com/nasemul1/chat-app)