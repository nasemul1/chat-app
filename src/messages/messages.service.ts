import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, lt } from "drizzle-orm";
import { DRIZZLE } from "../database/database.module";
import { messages, rooms } from "../database/schema";
import { RedisService } from "../redis/redis.service";
import { generateMessageId } from "../common/utils/id-generator";
import { RoomNotFoundException } from "../common/exceptions/room-not-found.exception";
import { MessageTooLongException } from "../common/exceptions/message-too-long.exception";
import { Room } from "../database/schema";

export interface MessagePageItem {
  id: string;
  roomId: string;
  username: string;
  content: string;
  createdAt: Date;
}

export interface PaginatedMessages {
  messages: MessagePageItem[];
  hasMore: boolean;
  nextCursor: string | null;
}

@Injectable()
export class MessagesService {
  constructor(
    @Inject(DRIZZLE) private db: any,
    private redisService: RedisService,
  ) {}

  private async assertRoomExists(roomId: string): Promise<Room> {
    const room = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (room.length === 0) {
      throw new RoomNotFoundException(roomId);
    }

    return room[0];
  }

  async getRoomMessages(
    roomId: string,
    limit = 50,
    before?: string,
  ): Promise<PaginatedMessages> {
    await this.assertRoomExists(roomId);

    let whereClause;

    if (before) {
      // Resolve the cursor message's createdAt so we can filter by time.
      // Using lt(messages.id, before) would be wrong because IDs are random
      // strings — lexicographic order does not equal insertion order.
      const cursorRows = await this.db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(and(eq(messages.id, before), eq(messages.roomId, roomId)))
        .limit(1);

      const cursorCreatedAt =
        cursorRows.length > 0 ? cursorRows[0].createdAt : null;

      whereClause = cursorCreatedAt
        ? and(
            eq(messages.roomId, roomId),
            lt(messages.createdAt, cursorCreatedAt),
          )
        : eq(messages.roomId, roomId);
    } else {
      whereClause = eq(messages.roomId, roomId);
    }

    const rows = await this.db
      .select()
      .from(messages)
      .where(whereClause)
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && page.length > 0 ? page[page.length - 1].id : null;

    return {
      messages: page,
      hasMore,
      nextCursor,
    };
  }

  async createMessage(
    roomId: string,
    username: string,
    content: string | undefined,
  ): Promise<MessagePageItem> {
    await this.assertRoomExists(roomId);

    const trimmedContent = typeof content === "string" ? content.trim() : "";
    if (!trimmedContent) {
      throw new MessageTooLongException("Message content cannot be empty");
    }
    if (trimmedContent.length > 1000) {
      throw new MessageTooLongException(
        "Message content must not exceed 1000 characters",
      );
    }

    const messageId = generateMessageId();
    const insertedMessages = await this.db
      .insert(messages)
      .values({
        id: messageId,
        roomId,
        username,
        content: trimmedContent,
      })
      .returning();

    const savedMessage = insertedMessages[0];

    await this.redisService.publish(
      `chat:messages:${roomId}`,
      JSON.stringify({
        event: "message:new",
        roomId,
        message: savedMessage,
      }),
    );

    return {
      id: savedMessage.id,
      roomId: savedMessage.roomId,
      username: savedMessage.username,
      content: savedMessage.content,
      createdAt: savedMessage.createdAt,
    };
  }
}
