# Architecture — Anonymous Chat Backend

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Session Strategy](#session-strategy)
3. [Redis pub/sub — WebSocket Fan-Out](#redis-pubsub--websocket-fan-out)
4. [Estimated Concurrent User Capacity](#estimated-concurrent-user-capacity)
5. [Scaling to 10× Load](#scaling-to-10-load)
6. [Known Limitations & Trade-offs](#known-limitations--trade-offs)

---

## Architecture Overview

```
 ┌──────────────────────────────────────────────────────────────────┐
 │                         Clients                                  │
 │            (Browser / Mobile / Automated Test Scripts)           │
 └─────────────────────┬──────────────────┬────────────────────────┘
                       │ REST (HTTP/JSON)  │ WebSocket (Socket.io)
                       ▼                  ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │                    NestJS Application                            │
 │                                                                  │
 │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
 │  │ AuthModule   │  │ RoomsModule  │  │   MessagesModule     │   │
 │  │              │  │              │  │                      │   │
 │  │ POST /login  │  │ GET  /rooms  │  │ GET  /rooms/:id/     │   │
 │  │              │  │ POST /rooms  │  │      messages        │   │
 │  │ SessionGuard │  │ GET  /:id    │  │ POST /rooms/:id/     │   │
 │  │ (global)     │  │ DELETE /:id  │  │      messages        │   │
 │  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
 │         │                 │                      │               │
 │         └─────────────────┴──────────────────────┘               │
 │                           │                                      │
 │                    ┌──────▼──────┐                               │
 │                    │ RedisModule │◄── shared by all modules       │
 │                    └──────┬──────┘                               │
 │                           │                                      │
 │  ┌────────────────────────▼─────────────────────────────────┐    │
 │  │                    ChatModule                            │    │
 │  │            ChatGateway  /chat  (Socket.io)               │    │
 │  │                                                          │    │
 │  │   on connect    → validate token + roomId via Redis/DB   │    │
 │  │                  → SADD room:active:<roomId>              │    │
 │  │                  → HSET socket:<socketId>                │    │
 │  │                  → emit room:joined / room:user_joined   │    │
 │  │                                                          │    │
 │  │   on disconnect → SREM room:active:<roomId>              │    │
 │  │   / room:leave  → DEL  socket:<socketId>                 │    │
 │  │                  → emit room:user_left                   │    │
 │  │                                                          │    │
 │  │   Redis sub     → psubscribe chat:messages:*             │    │
 │  │                            chat:rooms:*                  │    │
 │  │                  → server.to(roomId).emit(event)         │    │
 │  └──────────────────────────────────────────────────────────┘    │
 │                                                                  │
 │  ┌────────────────────────────────┐                              │
 │  │        DatabaseModule          │                              │
 │  │  Drizzle ORM  ──►  pg.Pool     │                              │
 │  └───────────────┬────────────────┘                              │
 └──────────────────┼───────────────────────────────────────────────┘
                    │                    │
                    ▼                    ▼
            ┌──────────────┐    ┌──────────────────────────────────┐
            │  PostgreSQL  │    │               Redis              │
            │              │    │                                  │
            │  users       │    │  session:<token>       (STRING)  │
            │  rooms       │    │  room:active:<roomId>  (SET)     │
            │  messages    │    │  socket:<socketId>     (HASH)    │
            └──────────────┘    │  chat:messages:<roomId> (PubSub) │
                                │  chat:rooms:<roomId>    (PubSub) │
                                └──────────────────────────────────┘
```

### Request Lifecycle — Sending a Message

```
 REST Client
     │
     │  POST /api/v1/rooms/:id/messages  { content }
     ▼
 MessagesController
     │
     │  messagesService.createMessage(roomId, username, content)
     ▼
 MessagesService
     ├── assertRoomExists()  ──► PostgreSQL SELECT
     ├── validate & trim content
     ├── db.insert(messages)  ──► PostgreSQL INSERT
     ├── redisService.publish('chat:messages:<roomId>', JSON payload)
     │                                  │
     │   ┌───────────────────────────────┘
     │   │  Redis pub/sub delivers to ALL instances
     │   ▼
     │  ChatGateway.handleRedisEvent()
     │      └── server.to(roomId).emit('message:new', message)
     │              └── Socket.io Redis adapter fans out
     │                  to ALL connected clients in the room
     │                  across ALL server instances
     ▼
 return saved message  ──►  TransformInterceptor wraps in { success, data }
     ▼
 REST response 201
```

### Global Infrastructure

| Concern | Implementation |
|---|---|
| Auth guard | `SessionGuard` registered as global `APP_GUARD`; `@Public()` decorator bypasses it |
| Response envelope | `TransformInterceptor` wraps all controller returns in `{ success: true, data }` |
| Error envelope | `HttpExceptionFilter` normalises all exceptions to `{ success: false, error: { code, message } }` |
| Validation | Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true` |
| API docs | Swagger at `/api-docs`, Scalar interactive UI at `/reference` |

---

## Session Strategy

### Token Generation

On every `POST /login`, a session token is generated using Node's built-in `crypto` module:

```ts
import crypto from 'crypto';
const token = crypto.randomBytes(32).toString('hex'); // 64 hex chars
```

This produces a 256-bit cryptographically random opaque string. No JWTs or signing keys are required because the server is the sole authority — it stores and validates every token itself.

### Storage in Redis

The token is stored in Redis with a 24-hour TTL:

```
SET session:<token>  '{"userId":"usr_xxx","username":"ali_123"}'  EX 86400
```

**Key:** `session:<token>` — the token itself is the key, so lookups are O(1).  
**Value:** A JSON-serialised object containing `userId` and `username`.  
**TTL:** `86400` seconds (24 hours). Redis expires the key automatically.

### Token Validation (SessionGuard)

On every protected request, `SessionGuard`:

1. Reads the `Authorization: Bearer <token>` header.
2. Issues `GET session:<token>` to Redis.
3. If the key is missing or expired → throws `401 UNAUTHORIZED`.
4. If found → deserialises the payload and attaches `{ userId, username }` to `req.user`.

No database round-trip is needed for authentication — Redis handles it entirely.

### Token Refresh

The spec is intentionally simple: every successful `POST /login` call overwrites the Redis key with a brand-new token and a fresh 24-hour TTL. There is no sliding window; the token always expires exactly 24 hours from the last login.

### WebSocket Auth

The Chat Gateway validates the token identically, reading it from `socket.handshake.query.token`. Validation happens in a Socket.io middleware (`server.use`) so the resolved `{ username, roomId }` is cached in `socket.data.joinState` before `handleConnection` fires — avoiding a redundant round-trip.

---

## Redis pub/sub — WebSocket Fan-Out

### The Problem

When a message is `POST`ed to the REST API, only one server instance handles that HTTP request. But WebSocket clients may be connected to *any* instance. A direct `socket.emit` from the controller would only reach clients on the same process.

### The Solution

```
Instance A (handles REST POST)          Instance B            Instance C
        │                                    │                     │
  MessagesService                       ChatGateway           ChatGateway
  redis.publish(                        subscribed to         subscribed to
    'chat:messages:<roomId>',           chat:messages:*       chat:messages:*
    payload                                  │                     │
  )                                          │                     │
        │                                    │                     │
        └──────────── Redis pub/sub ─────────┴─────────────────────┘
                      delivers to all
                      subscribers
```

Every instance's `ChatGateway` subscribes to the `chat:messages:*` and `chat:rooms:*` patterns at startup using `psubscribe`. When any instance publishes a message, Redis delivers it to **all** subscribing instances. Each gateway then calls:

```ts
this.server.to(roomId).emit('message:new', message);
```

### Socket.io Redis Adapter

In addition to the manual pub/sub subscription used for `message:new` and `room:deleted`, the `@socket.io/redis-adapter` package is wired to the Socket.io server. This adapter uses its own internal Redis channels to synchronise socket room memberships across instances, so `server.to(roomId)` on any instance correctly resolves to clients connected on *all* instances.

Two separate `ioredis` client connections are required by the adapter — one for publishing and one for subscribing — since a Redis client in subscribe mode cannot issue other commands.

### Room Deletion Flow

```
DELETE /rooms/:id
    │
    ├── publish 'chat:rooms:<id>'  { event: 'room:deleted', roomId }
    │       └── every instance emits room:deleted to clients  ← happens first
    │
    └── db.delete(rooms).where(eq(rooms.id, id))              ← DB delete second
```

The publish always happens **before** the database delete, ensuring all connected clients receive the `room:deleted` event while the room still technically exists, giving them time to gracefully close their connections.

---

## Estimated Concurrent User Capacity

### Assumptions (single instance, typical cloud VM: 2 vCPU, 2 GB RAM)

| Resource | Limit | Reasoning |
|---|---|---|
| Node.js event loop | ~10 000 active WebSocket connections | Each socket is an open file descriptor; practical limit before latency degrades ~10–50 k depending on message rate |
| Memory per connection | ~10–15 KB | Socket.io overhead + receive buffer + Redis per-socket hash entry |
| Total RAM for 10 000 sockets | ~150 MB | 10 000 × 15 KB |
| Redis round-trips per message | 2–3 | HGETALL + SMEMBERS + PUBLISH |
| Redis latency | ~0.5 ms (same DC) | Each event requires 2–3 Redis calls → ~1–2 ms overhead |
| PostgreSQL connections | Capped by `pg.Pool` (default 10) | REST endpoints only; WebSocket traffic is Redis-only post-connect |

**Realistic estimate:** **5 000 – 8 000 concurrent WebSocket connections**, with REST throughput of ~500–1 000 req/s (bottlenecked by PostgreSQL pool and Drizzle query overhead).

The main constraints are:
- **File descriptor limit** (typically 65 535 per process; `ulimit -n` must be raised for large deployments).
- **Redis latency** for every connect/disconnect/message event — becomes noticeable above ~1 000 events/s.
- **Single-threaded Node.js event loop** — CPU-bound work (JSON parsing, Redis serialisation) will starve I/O above ~5 000 active chatters sending at high frequency.

---

## Scaling to 10× Load

To support ~50 000–80 000 concurrent users (10× the single-instance estimate):

### 1. Horizontal Scaling — Multiple NestJS Instances

Run 4–8 instances behind a load balancer (e.g., nginx, AWS ALB). Socket.io with the Redis adapter handles WebSocket fan-out transparently — no code changes required. The load balancer must use **sticky sessions** (cookie or IP-hash) for the WebSocket upgrade handshake; after that, the Redis adapter ensures events reach all instances.

### 2. PostgreSQL Connection Pooling — PgBouncer

Each NestJS instance creates its own `pg.Pool`. At 8 instances × 10 connections = 80 connections to PostgreSQL, which approaches its default `max_connections = 100`. Add **PgBouncer** in transaction-pooling mode to multiplex hundreds of application connections onto a smaller pool of real PostgreSQL connections.

### 3. Redis Cluster or Redis Sentinel

A single Redis node becomes the bottleneck for sessions, active user sets, and pub/sub at high scale. Options:
- **Redis Sentinel** — high availability with automatic failover (no sharding, simpler).
- **Redis Cluster** — horizontal sharding across multiple nodes for write throughput (requires `ioredis` cluster client).

At 10× load, pub/sub message rate may exceed ~100 000 msg/s on a single Redis node. Redis Cluster with separate nodes for pub/sub vs. data storage is the right long-term path.

### 4. Separate Read Replicas for PostgreSQL

Message history reads (`GET /rooms/:id/messages`) are the most frequent DB query. Route them to a PostgreSQL read replica, keeping writes (inserts, deletes) on the primary.

### 5. CDN / Rate Limiting

Add rate limiting on `POST /login` and `POST /rooms/:id/messages` to prevent abuse. A reverse proxy (nginx, Cloudflare) can enforce this without touching application code.

### Summary

| Change | Why |
|---|---|
| 4–8 NestJS instances + sticky LB | Distribute CPU and connection load |
| PgBouncer | Avoid exhausting PostgreSQL `max_connections` |
| Redis Cluster / Sentinel | HA and throughput for sessions + pub/sub |
| PostgreSQL read replica | Offload message history reads |
| Rate limiting at edge | Prevent abuse from degrading the service |

---

## Known Limitations & Trade-offs

### 1. Cursor Pagination and Millisecond Collisions

`GET /rooms/:id/messages` uses the `createdAt` timestamp of the cursor message to filter older messages. If two messages are inserted within the same millisecond (microsecond collisions are theoretically possible under heavy load), some messages could be skipped or duplicated at page boundaries. A production implementation would use a compound cursor `(createdAt, id)` to handle ties deterministically.

### 2. Single-Room-Per-Socket Connection

The current WebSocket design assumes one socket ↔ one room. A client that wants to monitor multiple rooms must open multiple connections. This increases connection count and Redis state proportionally. A multi-room subscription model (client sends `room:join` events on a single socket) would be more efficient at scale but requires a more complex state model.

### 3. No Message Delivery Acknowledgement

`message:new` is emitted on a best-effort basis via Redis pub/sub. If a client is momentarily disconnected and misses the event, it will not receive the message unless it re-fetches history via `GET /rooms/:id/messages`. There is no retry or acknowledgement mechanism.

### 4. Active User Count Under Network Partitions

If a server instance crashes without a clean shutdown, its sockets' entries in `socket:<socketId>` and `room:active:<roomId>` Redis keys are never cleaned up. The active user count will remain inflated until a new connection for the same user triggers cleanup, or until the Redis key is manually purged. A TTL on `socket:<socketId>` keys (e.g., `EXPIRE socket:<id> 3600`) or a heartbeat mechanism would mitigate this.

### 5. No Token Invalidation on Logout

There is no logout endpoint. Session tokens cannot be explicitly revoked — they expire naturally after 24 hours. This is acceptable for the anonymous/low-security use case but would be inadequate for any application handling sensitive data.

### 6. `pg.Pool` Shared Across All Requests

The Drizzle database module creates one `pg.Pool` per application instance. The default pool size is 10 connections. Under high concurrent REST load this can become a queue bottleneck. Tuning `max` and `idleTimeoutMillis` in the pool config, or adopting PgBouncer externally, is the recommended mitigation.

### 7. In-Process Redis Pattern Subscriptions

The `ChatGateway` subscribes to `chat:messages:*` and `chat:rooms:*` using `psubscribe`. These subscriptions are per-instance. In a multi-instance deployment each instance subscribes independently, meaning a published message is received (and re-emitted locally) by every instance. The Socket.io Redis adapter already handles fan-out to remote clients, so the local re-emit is harmless but slightly redundant — the manual pub/sub subscription is only necessary because the Redis adapter does not forward arbitrary application-level channels.
