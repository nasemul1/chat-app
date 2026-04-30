import {
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  ConnectedSocket,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DRIZZLE } from '../database/database.module';
import { rooms } from '../database/schema';
import { AuthService } from '../auth/auth.service';
import { RedisService } from '../redis/redis.service';

type HandshakeQueryValue = string | string[] | undefined;

interface RoomJoinState {
  username: string;
  roomId: string;
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
  },
})
@Injectable()
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private redisListenersBound = false;

  constructor(
    @Inject(DRIZZLE) private db: any,
    private authService: AuthService,
    private redisService: RedisService,
  ) {}

  afterInit(server: Server) {
    if (!this.redisListenersBound) {
      const subClient = this.redisService.getSubClient();
      subClient.psubscribe('chat:messages:*', 'chat:rooms:*', (error) => {
        if (error) {
          console.error('Failed to subscribe to chat Redis patterns:', error);
        }
      });

      subClient.on('pmessage', (_pattern, channel, message) => {
        void this.handleRedisEvent(channel, message);
      });

      this.redisListenersBound = true;
    }

    server.use(async (socket, next) => {
      try {
        await this.validateHandshake(socket);
        next();
      } catch (error) {
        const code = error instanceof Error && error.message ? error.message : '401';
        next(new Error(code));
      }
    });
  }

  async handleConnection(client: Socket) {
    try {
      const { username, roomId } = await this.resolveJoinState(client);

      await this.redisService.addActiveUser(roomId, username);
      await this.redisService.setSocketState(client.id, {
        username,
        roomId,
      });

      await client.join(roomId);

      const activeUsers = await this.redisService.getActiveUsers(roomId);
      client.emit('room:joined', { activeUsers });
      client.to(roomId).emit('room:user_joined', {
        username,
        activeUsers,
      });
    } catch (error) {
      const code = error instanceof Error && error.message ? error.message : '401';
      client.emit('error', { code });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    await this.cleanupSocket(client, false);
  }

  @SubscribeMessage('room:leave')
  async onRoomLeave(@ConnectedSocket() client: Socket): Promise<void> {
    await this.handleRoomLeave(client);
  }

  async onModuleDestroy(): Promise<void> {
    // RedisService owns client lifecycle.
  }

  async handleRoomLeave(client: Socket): Promise<void> {
    await this.cleanupSocket(client, true);
    client.disconnect(true);
  }

  private async handleRedisEvent(channel: string, message: string): Promise<void> {
    try {
      const payload = JSON.parse(message) as
        | { event: 'message:new'; roomId: string; message: Record<string, unknown> }
        | { event: 'room:deleted'; roomId: string };

      if (channel.startsWith('chat:messages:') && payload.event === 'message:new') {
        this.server.to(payload.roomId).emit('message:new', payload.message);
        return;
      }

      if (channel.startsWith('chat:rooms:') && payload.event === 'room:deleted') {
        this.server.to(payload.roomId).emit('room:deleted', {
          roomId: payload.roomId,
        });
      }
    } catch (error) {
      console.error('Failed to process Redis chat event:', error);
    }
  }

  private async validateHandshake(socket: Socket): Promise<void> {
    const { token, roomId } = this.readQuery(socket);
    if (!token || !roomId) {
      throw new Error('401');
    }

    const session = await this.authService.validateSession(token);
    if (!session) {
      throw new Error('401');
    }

    const roomExists = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (roomExists.length === 0) {
      throw new Error('404');
    }
  }

  private async resolveJoinState(socket: Socket): Promise<RoomJoinState> {
    const { token, roomId } = this.readQuery(socket);
    if (!token || !roomId) {
      throw new Error('401');
    }

    const session = await this.authService.validateSession(token);
    if (!session) {
      throw new Error('401');
    }

    const roomExists = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (roomExists.length === 0) {
      throw new Error('404');
    }

    return {
      username: session.username,
      roomId,
    };
  }

  private async cleanupSocket(client: Socket, emitRoomLeft: boolean): Promise<void> {
    const state = await this.redisService.getSocketState(client.id);
    if (!state.username || !state.roomId) {
      return;
    }

    await this.redisService.removeActiveUser(state.roomId, state.username);
    await this.redisService.deleteSocketState(client.id);

    if (emitRoomLeft) {
      const activeUsers = await this.redisService.getActiveUsers(state.roomId);
      client.to(state.roomId).emit('room:user_left', {
        username: state.username,
        activeUsers,
      });
    }
  }

  private readQuery(socket: Socket): {
    token?: string;
    roomId?: string;
  } {
    const token = this.getFirstQueryValue(socket.handshake.query.token);
    const roomId = this.getFirstQueryValue(socket.handshake.query.roomId);

    return { token, roomId };
  }

  private getFirstQueryValue(value: HandshakeQueryValue): string | undefined {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      return value[0];
    }

    return undefined;
  }
}
