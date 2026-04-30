import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.module';
import { rooms } from '../database/schema';
import { RedisService } from '../redis/redis.service';
import { generateRoomId } from '../common/utils/id-generator';
import { RoomNotFoundException } from '../common/exceptions/room-not-found.exception';
import { RoomNameTakenException } from '../common/exceptions/room-name-taken.exception';
import { ForbiddenDeleteException } from '../common/exceptions/forbidden-delete.exception';
import { Room } from '../database/schema';

export interface RoomWithActiveUsers extends Room {
  activeUsers: number;
}

@Injectable()
export class RoomsService {
  constructor(
    @Inject(DRIZZLE) private db: any,
    private redisService: RedisService,
  ) {}

  async getAllRooms(): Promise<RoomWithActiveUsers[]> {
    const allRooms = await this.db.select().from(rooms);
    
    // Fetch active user count for each room from Redis
    const roomsWithActiveUsers = await Promise.all(
      allRooms.map(async (room: Room) => ({
        ...room,
        activeUsers: await this.redisService.getActiveUserCount(room.id),
      })),
    );

    return roomsWithActiveUsers;
  }

  async createRoom(name: string, createdBy: string): Promise<Room> {
    // Check if room name already exists
    const existingRoom = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.name, name))
      .limit(1);

    if (existingRoom.length > 0) {
      throw new RoomNameTakenException();
    }

    // Create new room
    const roomId = generateRoomId();
    const newRoom = await this.db
      .insert(rooms)
      .values({
        id: roomId,
        name,
        createdBy,
      })
      .returning();

    return newRoom[0];
  }

  async getRoomById(id: string): Promise<RoomWithActiveUsers> {
    const room = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1);

    if (room.length === 0) {
      throw new RoomNotFoundException(id);
    }

    const activeUsers = await this.redisService.getActiveUserCount(id);

    return {
      ...room[0],
      activeUsers,
    };
  }

  async deleteRoom(id: string, username: string): Promise<void> {
    // Check if room exists
    const room = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1);

    if (room.length === 0) {
      throw new RoomNotFoundException(id);
    }

    // Check if user is the creator
    if (room[0].createdBy !== username) {
      throw new ForbiddenDeleteException();
    }

    // Publish room:deleted event to Redis pub/sub
    await this.redisService.publish(
      `chat:rooms:${id}`,
      JSON.stringify({ event: 'room:deleted', roomId: id }),
    );

    // Delete room from database (cascade deletes messages)
    await this.db.delete(rooms).where(eq(rooms.id, id));
  }
}
