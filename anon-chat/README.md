# Anonymous Chat Backend

A real-time group chat service built with NestJS, PostgreSQL, Drizzle ORM, Redis, and Socket.io.

## Stack

- **NestJS** - TypeScript framework for building scalable server-side applications
- **PostgreSQL** - Relational database for persistent storage
- **Drizzle ORM** - Lightweight and performant TypeScript ORM
- **Redis** - In-memory data store for sessions, active user tracking, and pub/sub
- **Socket.io** - Real-time bidirectional communication via WebSocket
- **TypeScript** - Strongly typed JavaScript

## Features

- ✅ Anonymous user authentication with session tokens
- ✅ Create and join chat rooms
- ✅ Real-time message exchange with persistence
- ✅ Active user tracking per room
- ✅ Cursor-based pagination for message history
- ✅ Multi-instance scalability via Redis pub/sub
- ✅ Type-safe database operations with Drizzle ORM

## Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- **Docker & Docker Compose** (for PostgreSQL and Redis)

## Installation & Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd anon-chat
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start PostgreSQL and Redis

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on `localhost:5432` (user: postgres, password: postgres)
- Redis on `localhost:6379`

### 4. Configure environment variables

```bash
cp .env.example .env
```

The `.env` file contains:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `PORT` - Server port (default: 3000)
- `SESSION_TOKEN_EXPIRY` - Session TTL in seconds (default: 86400 = 24 hours)

### 5. Run database migrations

```bash
npx drizzle-kit push:pg
```

This creates the required tables: `users`, `rooms`, and `messages`.

### 6. Start the application

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

## API Endpoints

### Base Path
All endpoints use `/api/v1` as the base path.

### Authentication

**POST** `/login`
- Request: `{ "username": "ali_123" }`
- Response: `{ "sessionToken": "...", "user": { "id", "username", "createdAt" } }`

### Rooms

- **GET** `/rooms` - List all rooms
- **POST** `/rooms` - Create a new room
- **GET** `/rooms/:id` - Get room details
- **DELETE** `/rooms/:id` - Delete room (creator only)

### Messages

- **GET** `/rooms/:id/messages` - Get paginated message history (query params: `limit`, `before`)
- **POST** `/rooms/:id/messages` - Send a message

## WebSocket

Connect to the `/chat` namespace:

```
ws://localhost:3000/chat?token=<sessionToken>&roomId=<roomId>
```

### Server Events
- `room:joined` - User connected to room
- `room:user_joined` - Another user joined
- `message:new` - New message in room
- `room:user_left` - User left or disconnected
- `room:deleted` - Room was deleted

### Client Events
- `room:leave` - Graceful disconnect

## Project Structure

```
src/
├── auth/                  # Authentication module
├── rooms/                 # Rooms management
├── messages/              # Message handling
├── chat/                  # WebSocket gateway
├── database/              # Drizzle ORM setup
├── redis/                 # Redis service
├── common/
│   ├── interceptors/      # Response envelope wrapper
│   ├── filters/           # Global error handler
│   ├── exceptions/        # Custom exceptions
│   └── utils/             # Helper functions
├── app.module.ts
└── main.ts
```

## Development

### Available Scripts

```bash
npm run start:dev    # Start with hot reload
npm run build        # Build for production
npm run start:prod   # Run production build
npm run lint         # Run ESLint
npm run format       # Format with Prettier
npm test             # Run tests
```

## API Response Format

All responses follow a consistent envelope structure:

**Success (2xx)**
```json
{
  "success": true,
  "data": { }
}
```

**Error (4xx, 5xx)**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Validation failed |
| `UNAUTHORIZED` | 401 | Missing or expired token |
| `FORBIDDEN` | 403 | Access denied |
| `ROOM_NOT_FOUND` | 404 | Room doesn't exist |
| `ROOM_NAME_TAKEN` | 409 | Room name already exists |
| `MESSAGE_TOO_LONG` | 422 | Message exceeds 1000 characters |

## Database Schema

### Users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### Rooms
```sql
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### Messages
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

## Testing

Run the test suite:

```bash
npm test
npm test:watch      # Watch mode
npm test:cov        # With coverage
```

## Deployment

See `ARCHITECTURE.md` for deployment recommendations.

### Quick Deploy to Render

1. Push code to GitHub
2. Create new Web Service on Render
3. Connect repository
4. Set environment variables
5. Deploy

## Contributing

1. Create a feature branch
2. Make changes
3. Run linting and tests
4. Submit a pull request

## License

ISC

## Support

For issues or questions, please open a GitHub issue.
