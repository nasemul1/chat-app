# Anonymous Chat Backend — Build Plan

**Stack:** NestJS · PostgreSQL · Drizzle ORM · Redis · Socket.io · TypeScript

---

## Architecture Overview

```
Clients (REST + WebSocket)
        │
        ▼
┌─────────────────────────────────────────────────┐
│                 NestJS Application               │
│                                                  │
│  Auth      Rooms      Messages    Chat Gateway   │
│  Module    Module     Module      (Socket.io)    │
│                                                  │
│           Redis Service (shared)                 │
└────────────────┬────────────────┬───────────────┘
                 │                │
                 ▼                ▼
          PostgreSQL            Redis
          (Drizzle ORM)   sessions · room sets
          users · rooms   pub/sub · WS adapter
          messages
```

**Multi-instance fan-out:** REST controller publishes `message:new` to a Redis channel. The Socket.io Redis adapter running on every instance picks it up and broadcasts to all connected clients in that room — no direct socket emit from the controller.

---

## Project Structure

```
src/
├── auth/
│   ├── auth.controller.ts       # POST /login
│   ├── auth.service.ts          # upsert user, generate session token
│   ├── auth.module.ts
│   └── session.guard.ts         # reads Bearer token, attaches req.user
├── rooms/
│   ├── rooms.controller.ts      # GET/POST/DELETE /rooms, GET /rooms/:id
│   ├── rooms.service.ts         # CRUD + active user count from Redis
│   └── rooms.module.ts
├── messages/
│   ├── messages.controller.ts   # GET/POST /rooms/:id/messages
│   ├── messages.service.ts      # persist to DB, publish to Redis
│   └── messages.module.ts
├── chat/
│   ├── chat.gateway.ts          # Socket.io /chat namespace
│   └── chat.module.ts
├── redis/
│   ├── redis.service.ts         # ioredis client, pub/sub, active user helpers
│   └── redis.module.ts
├── database/
│   ├── schema.ts                # Drizzle table definitions
│   ├── drizzle.service.ts       # db instance provider
│   └── database.module.ts
└── common/
    ├── interceptors/
    │   └── transform.interceptor.ts   # wraps all responses in success envelope
    ├── filters/
    │   └── http-exception.filter.ts   # maps exceptions to error envelope
    └── exceptions/
        ├── room-not-found.exception.ts
        ├── room-name-taken.exception.ts
        ├── forbidden-delete.exception.ts
        └── message-too-long.exception.ts
```

---

## Phase 1 — Project Scaffold

**Goal:** working skeleton with Docker, all deps installed, config wired up.

### Steps

1. `nest new anon-chat --package-manager npm`
2. Install dependencies:

```bash
npm install @nestjs/platform-socket.io @nestjs/websockets
npm install drizzle-orm pg drizzle-kit
npm install ioredis @socket.io/redis-adapter
npm install class-validator class-transformer nanoid
npm install @nestjs/config
```

3. Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: anon_chat
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

4. Set up `.env`:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/anon_chat
REDIS_URL=redis://localhost:6379
```

5. Enable `ValidationPipe`, `TransformInterceptor`, and `HttpExceptionFilter` globally in `main.ts`.

---

## Phase 2 — Database Schema (Drizzle)

**Goal:** three tables, prefixed IDs, migration ready.

### Schema (`src/database/schema.ts`)

```ts
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id:        text('id').primaryKey(),        // usr_xxxxx
  username:  text('username').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const rooms = pgTable('rooms', {
  id:        text('id').primaryKey(),        // room_xxxxx
  name:      text('name').notNull().unique(),
  createdBy: text('created_by').notNull(),   // username string
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id:        text('id').primaryKey(),        // msg_xxxxx
  roomId:    text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  username:  text('username').notNull(),
  content:   text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### ID Generation helper

```ts
import { customAlphabet } from 'nanoid';
const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);

export const genId = (prefix: string) => `${prefix}_${nanoid()}`;
// genId('usr')  → usr_a1b2c3
// genId('room') → room_x9y8z7
// genId('msg')  → msg_ab12cd
```

### Drizzle config (`drizzle.config.ts`)

```ts
export default {
  schema: './src/database/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: { connectionString: process.env.DATABASE_URL },
};
```

Run migrations: `npx drizzle-kit generate:pg && npx drizzle-kit push:pg`

---

## Phase 3 — Auth Module

**Goal:** `POST /login`, session token generation, `SessionGuard`.

### Flow

```
POST /login { username }
  └─ upsert user in PostgreSQL (by username)
  └─ generate token: crypto.randomBytes(32).toString('hex')
  └─ store in Redis:  SET session:<token> { userId, username } EX 86400
  └─ return { sessionToken, user }
```

### SessionGuard

- Reads `Authorization: Bearer <token>` header
- Looks up `session:<token>` in Redis
- If missing or expired → throw `401 UNAUTHORIZED`
- Attaches `{ userId, username }` to `req.user`
- Applied globally; excluded on `POST /login`

### Validation

- Username: 2–24 chars, `/^[a-zA-Z0-9_]+$/`
- Use `class-validator` decorators on the DTO

---

## Phase 4 — Response Envelope

**Goal:** every response matches the exact contract shape.

### Success envelope (`TransformInterceptor`)

```ts
// Wraps any controller return value:
return { success: true, data: value };
```

### Error envelope (`HttpExceptionFilter`)

```ts
// Catches HttpException and maps to:
return {
  success: false,
  error: {
    code: exception.getCode(),      // e.g. "ROOM_NOT_FOUND"
    message: exception.getMessage()
  }
};
```

### Custom exceptions

Each carries a stable `code` string matching the spec:

| Exception class | HTTP status | code |
|---|---|---|
| `RoomNotFoundException` | 404 | `ROOM_NOT_FOUND` |
| `RoomNameTakenException` | 409 | `ROOM_NAME_TAKEN` |
| `ForbiddenDeleteException` | 403 | `FORBIDDEN` |
| `MessageTooLongException` | 422 | `MESSAGE_TOO_LONG` |
| `ValidationException` | 400 | `VALIDATION_ERROR` |
| `UnauthorizedException` | 401 | `UNAUTHORIZED` |

---

## Phase 5 — Rooms Module

**Goal:** all five room endpoints; `activeUsers` pulled from Redis.

### Endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/rooms` | list all rooms; `activeUsers` from Redis |
| `POST` | `/rooms` | create room; 409 if name taken |
| `GET` | `/rooms/:id` | single room + `activeUsers` |
| `DELETE` | `/rooms/:id` | creator only; emit `room:deleted` via Redis before delete |

### Room name validation

- 3–32 chars, `/^[a-zA-Z0-9-]+$/`

### Active user count

```ts
// Redis key pattern:
`room:active:${roomId}`   // a Redis SET of usernames

// Count:
await redis.scard(`room:active:${roomId}`)

// Members (for room:joined event):
await redis.smembers(`room:active:${roomId}`)
```

### Delete flow

```
DELETE /rooms/:id
  └─ fetch room → 404 if not found
  └─ check room.createdBy === req.user.username → 403 if not
  └─ publish { event: 'room:deleted', roomId } to Redis pub/sub channel
  └─ delete from PostgreSQL (cascade deletes messages)
  └─ return { deleted: true }
```

---

## Phase 6 — Messages Module

**Goal:** paginated history + send message via Redis pub/sub.

### GET `/rooms/:id/messages`

Cursor-based pagination (newest first):

```ts
const query = db
  .select()
  .from(messages)
  .where(
    and(
      eq(messages.roomId, roomId),
      before ? lt(messages.id, before) : undefined,
    )
  )
  .orderBy(desc(messages.createdAt))
  .limit(limit + 1);   // fetch one extra to determine hasMore

const hasMore = rows.length > limit;
const page    = rows.slice(0, limit);
const nextCursor = hasMore ? page[page.length - 1].id : null;
```

### POST `/rooms/:id/messages`

```
POST /rooms/:id/messages { content }
  └─ trim content; validate 1–1000 chars
  └─ check room exists → 404 if not
  └─ insert into PostgreSQL via Drizzle
  └─ publish to Redis: PUBLISH chat:messages:<roomId> <JSON payload>
  └─ return saved message  (do NOT emit socket directly here)
```

---

## Phase 7 — Chat Gateway (Socket.io)

**Goal:** WebSocket namespace `/chat`; all events per spec; Redis-backed state.

### Connection handshake

```
ws://host/chat?token=<sessionToken>&roomId=<roomId>
  └─ validate token in Redis → disconnect(401) if invalid
  └─ validate roomId in PostgreSQL → disconnect(404) if not found
  └─ SADD room:active:<roomId> <username>
  └─ store socket state in Redis: HSET socket:<socketId> username roomId
  └─ socket.join(roomId)
  └─ emit room:joined  → { activeUsers: string[] }          (to this client only)
  └─ emit room:user_joined → { username, activeUsers }      (to all others in room)
```

> **Important:** do not use in-memory JS Maps to track socket state. All state lives in Redis.

### Server → client events

| Event | Recipient | Payload |
|---|---|---|
| `room:joined` | connecting client only | `{ activeUsers: string[] }` |
| `room:user_joined` | all others in room | `{ username, activeUsers }` |
| `message:new` | all clients in room | `{ id, username, content, createdAt }` |
| `room:user_left` | all remaining in room | `{ username, activeUsers }` |
| `room:deleted` | all clients in room | `{ roomId }` |

### Client → server events

| Event | Payload | Server action |
|---|---|---|
| `room:leave` | none | SREM from Redis set, broadcast `room:user_left`, disconnect |

### Disconnect cleanup

```ts
handleDisconnect(socket) {
  const { username, roomId } = await redis.hgetall(`socket:${socket.id}`);
  await redis.srem(`room:active:${roomId}`, username);
  await redis.del(`socket:${socket.id}`);
  const remaining = await redis.smembers(`room:active:${roomId}`);
  socket.to(roomId).emit('room:user_left', { username, activeUsers: remaining });
}
```

### Redis pub/sub subscription

The gateway subscribes to `chat:messages:*` and `chat:rooms:*` channels at startup. When a message arrives it broadcasts to the matching socket.io room. This is what allows multiple server instances to fan-out events to all connected clients.

---

## Phase 8 — Redis Adapter (Socket.io Scaling)

**Goal:** Socket.io fan-out across multiple server instances.

```ts
// main.ts
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient }  from 'ioredis';

const pubClient = new Redis(process.env.REDIS_URL);
const subClient = pubClient.duplicate();

app.useWebSocketAdapter(
  new RedisIoAdapter(app, pubClient, subClient)
);
```

Two separate Redis clients are required — one for publishing, one for subscribing. The adapter handles all room-based fan-out automatically. From any instance, `server.to(roomId).emit(...)` reaches every client in that room across all instances.

---

## Phase 9 — Deliverables

### README.md (required)

Must include:

- Prerequisites (Node 20+, Docker)
- `docker-compose up -d` to start Postgres + Redis
- `cp .env.example .env`
- `npm install`
- `npx drizzle-kit push:pg`
- `npm run start:dev`
- Deployed URL

### ARCHITECTURE.md (required)

Must cover:

- [ ] Architecture overview with component interaction diagram
- [ ] Session strategy — token generation, Redis storage, 24h expiry
- [ ] Redis pub/sub fan-out — how multi-instance WebSocket scaling works
- [ ] Estimated concurrent user capacity on a single instance (with reasoning)
- [ ] What changes for 10× load (horizontal scaling, Redis Cluster, connection pooling)
- [ ] Known limitations and trade-offs

### Deployed URL (required)

Recommended: **Render** (free tier)
- One Web Service (NestJS app)
- Render managed PostgreSQL
- Render managed Redis

---

## Key Constraints to Remember

These are the most common contract violations that break automated test scripts:

1. **`activeUsers` must come from Redis** — never a database count
2. **`message:new` must be published to Redis** — never emitted directly from the REST controller
3. **WebSocket auth uses query params** — `?token=&roomId=` not a handshake event
4. **No in-memory JS Maps** for socket state — everything in Redis
5. **Cursor pagination uses message IDs** — not page numbers or offsets
6. **All IDs are prefixed strings** — `usr_`, `room_`, `msg_`
7. **Field names are exact** — `createdBy`, `activeUsers`, `hasMore`, `nextCursor`
8. **`room:deleted` event fires before the DB delete** — publish first, then delete
9. **Session tokens expire after 24 hours** — set Redis TTL to `86400`
10. **`nextCursor` is `null`** (not omitted) when there are no more pages