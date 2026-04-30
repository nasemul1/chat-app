# Anonymous Chat API — Back-end Interview Task

**Stack:** NestJS · PostgreSQL · Drizzle ORM · Redis · Socket.io · TypeScript

**Submit Deadline:** 30 April 2026 - 24:00 

---

## Overview

Build a real-time group chat service. Users identify with a username only — no passwords, no registration. They can create or join rooms and exchange messages instantly.

Messages are persisted to PostgreSQL. Real-time delivery is handled via WebSocket, scaled across multiple server instances using a Redis pub/sub adapter.

> We will test your submission using our own frontend and automated scripts built against the exact contract below. Do not deviate from field names, event names, or response shapes.
> 

---

## Tech Stack Requirements

You may add any utility libraries you need. The following are mandatory and will be evaluated:

- **NestJS** — all application structure and patterns
- **PostgreSQL + Drizzle ORM** — all database access must go through Drizzle, no raw query clients or other ORMs
- **Redis** — session storage and WebSocket scaling via pub/sub adapter
- **Socket.io** — real-time gateway

---

## REST API Contract

**Base path:** `/api/v1`

**Content type:** `application/json`

**Auth header:** `Authorization: Bearer <sessionToken>` — required on all routes except `/login`

### Response Envelope

Every response — success or error — is wrapped in a consistent envelope.

**Success**

```json
{
  "success": true,
  "data": { }
}
```

**Error**

```json
{
  "success": false,
  "error": {
    "code": "SNAKE_CASE_ERROR_CODE",
    "message": "Human-readable description of what went wrong"
  }
}
```

> `data` contains the resource or result payload. `error.code` is a stable machine-readable string your frontend can switch on. `error.message` is for display or debugging only.
> 

---

### POST `/login`

Get or create a user and return a session token.

**Request body**

```json
{
  "username": "ali_123"
}
```

> 2–24 characters, alphanumeric and underscores only.
> 

**Response `200`**

```json
{
  "success": true,
  "data": {
    "sessionToken": "<opaque token>",
    "user": {
      "id": "usr_a1b2c3",
      "username": "ali_123",
      "createdAt": "2024-03-01T10:00:00Z"
    }
  }
}
```

> If the username already exists, return the existing user with a fresh session token. This endpoint is idempotent by username. Session tokens expire after 24 hours.
> 

---

### GET `/rooms`

List all rooms.

**Response `200`**

```json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "id": "room_x9y8z7",
        "name": "general",
        "createdBy": "ali_123",
        "activeUsers": 4,
        "createdAt": "2024-03-01T10:00:00Z"
      }
    ]
  }
}
```

> `activeUsers` is a live count pulled from Redis, not the database.
> 

---

### POST `/rooms`

Create a new room.

**Request body**

```json
{
  "name": "general"
}
```

> 3–32 characters, alphanumeric and hyphens only. Must be unique.
> 

**Response `201`**

```json
{
  "success": true,
  "data": {
    "id": "room_x9y8z7",
    "name": "general",
    "createdBy": "ali_123",
    "createdAt": "2024-03-01T10:00:00Z"
  }
}
```

**Errors:** `409` room name already exists

---

### GET `/rooms/:id`

Get room details.

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "room_x9y8z7",
    "name": "general",
    "createdBy": "ali_123",
    "activeUsers": 4,
    "createdAt": "2024-03-01T10:00:00Z"
  }
}
```

**Errors:** `404` not found

---

### DELETE `/rooms/:id`

Delete a room and all its messages. Only the room creator can do this.

**Response `200`**

```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

**Errors:** `403` requester is not the room creator · `404` not found

> Before deleting, emit a `room:deleted` WebSocket event to all connected clients in this room via Redis pub/sub.
> 

---

### GET `/rooms/:id/messages`

Paginated message history.

**Query params**

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| `limit` | number | 50 | Max 100 |
| `before` | string | — | Message ID cursor — returns messages older than this |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg_ab12cd",
        "roomId": "room_x9y8z7",
        "username": "ali_123",
        "content": "hello everyone",
        "createdAt": "2024-03-01T10:05:22Z"
      }
    ],
    "hasMore": true,
    "nextCursor": "msg_zz9900"
  }
}
```

> `nextCursor` is `null` when there are no more pages.
> 

**Errors:** `404` room not found

---

### POST `/rooms/:id/messages`

Send a message. Persists to the database then broadcasts via Redis.

**Request body**

```json
{
  "content": "hello everyone"
}
```

> 1–1000 characters, trimmed server-side.
> 

**Response `201`**

```json
{
  "success": true,
  "data": {
    "id": "msg_ab12cd",
    "roomId": "room_x9y8z7",
    "username": "ali_123",
    "content": "hello everyone",
    "createdAt": "2024-03-01T10:05:22Z"
  }
}
```

> After saving to the database, publish a `message:new` event to Redis. The WebSocket gateway subscribes to this channel and broadcasts to all connected clients in the room — including those on other server instances. Do not emit directly from the REST controller.
> 

**Errors:** `404` room not found · `422` content empty or exceeds limit

---

### Error Examples

**`400` Validation error**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "username must be between 2 and 24 characters"
  }
}
```

**`401` Unauthorized**

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or expired session token"
  }
}
```

**`403` Forbidden**

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Only the room creator can delete this room"
  }
}
```

**`404` Not found**

```json
{
  "success": false,
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "Room with id room_x9y8z7 does not exist"
  }
}
```

**`409` Conflict**

```json
{
  "success": false,
  "error": {
    "code": "ROOM_NAME_TAKEN",
    "message": "A room with this name already exists"
  }
}
```

**`422` Unprocessable**

```json
{
  "success": false,
  "error": {
    "code": "MESSAGE_TOO_LONG",
    "message": "Message content must not exceed 1000 characters"
  }
}
```

---

## WebSocket Contract

Connect to the `/chat` namespace with the session token and target room as query parameters:

```
ws://host/chat?token=<sessionToken>&roomId=<roomId>
```

> Validate the token on every connection. Invalid or expired tokens must disconnect immediately with error code `401`. An unknown `roomId` must disconnect with `404`.
> 

---

### Server → Client Events

### `room:joined`

Emitted to the **connecting client only** on successful connection.

```json
{ "activeUsers": ["ali_123", "sara_x"] }
```

### `room:user_joined`

Broadcast to **all other clients** when a new user connects to the room.

```json
{ "username": "sara_x", "activeUsers": ["ali_123", "sara_x"] }
```

### `message:new`

Broadcast to **all clients in the room** when a message is posted via `POST /rooms/:id/messages`. There is no client-emit for sending messages — this event is always triggered by the REST endpoint.

```json
{
  "id": "msg_ab12cd",
  "username": "ali_123",
  "content": "hello everyone",
  "createdAt": "2024-03-01T10:05:22Z"
}
```

### `room:user_left`

Broadcast when a user disconnects or emits `room:leave`.

```json
{ "username": "sara_x", "activeUsers": ["ali_123"] }
```

### `room:deleted`

Broadcast to all connected clients when the room is deleted. Clients should close their connection on receipt.

```json
{ "roomId": "room_x9y8z7" }
```

---

### Client → Server Events

### `room:leave`

Graceful disconnect. No payload. The server removes the user from the Redis active-user set and broadcasts `room:user_left` to remaining clients.

---

## Redis Requirements

Redis must be used for the following. How you design and implement each is up to you.

- Session storage
- Active user tracking per room
- Socket connection state — do not use in-memory JS maps or objects to track connections
- WebSocket scaling across multiple server instances

---

## Deliverables

- [ ]  Source code in a public Git repository
- [ ]  `README.md` — setup instructions and how to get the project running locally
- [ ]  `ARCHITECTURE.md` — see requirements below
- [ ]  Deployed application URL (Render or any other platform)

**`ARCHITECTURE.md` must cover:**

- [ ]  Architecture overview — how components interact (a diagram is encouraged)
- [ ]  Session strategy — how token generation, storage, and expiry work
- [ ]  How Redis pub/sub enables WebSocket fan-out across multiple instances
- [ ]  Estimated concurrent user capacity on a single instance, with your reasoning
- [ ]  What you would change to scale this to 10× the load
- [ ]  Known limitations or trade-offs in your implementation

---

## Evaluation Criteria

| Area | Description |
| --- | --- |
| **API contract compliance** | All endpoints, field names, and WS event names match exactly |
| **Code quality** | NestJS structure, naming, separation of concerns, error handling |
| **Real-time correctness** | Events fire reliably, active user counts are accurate, disconnect is cleaned up |
| **Redis usage** | Sessions, active user sets, pub/sub fan-out via Socket.io adapter |
| **Architecture document** | Clarity of thinking, honest trade-off analysis, scaling rationale |

> Deviating from the API contract causes our test scripts to fail and will significantly affect your score. When in doubt, follow the contract exactly.
>
