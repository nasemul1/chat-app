import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Error Response ────────────────────────────────────────────────────────────

export class ErrorDetail {
  @ApiProperty({ example: 'VALIDATION_ERROR', description: 'Machine-readable error code (SNAKE_CASE)' })
  code!: string;

  @ApiProperty({ example: 'username must be between 2 and 24 characters', description: 'Human-readable error message' })
  message!: string;
}

export class ErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ type: ErrorDetail })
  error!: ErrorDetail;
}

// ─── User ──────────────────────────────────────────────────────────────────────

export class UserDto {
  @ApiProperty({ example: 'usr_a1b2c3', description: 'Unique user identifier' })
  id!: string;

  @ApiProperty({ example: 'ali_123', description: 'Username' })
  username!: string;

  @ApiProperty({ example: '2024-03-01T10:00:00.000Z', description: 'Account creation timestamp' })
  createdAt!: string;
}

// ─── Login ─────────────────────────────────────────────────────────────────────

export class LoginDataDto {
  @ApiProperty({ example: 'a4f8c2e1b3d5...', description: 'Opaque session token (hex, 64 chars). Expires after 24 hours.' })
  sessionToken!: string;

  @ApiProperty({ type: UserDto })
  user!: UserDto;
}

export class LoginResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ type: LoginDataDto })
  data!: LoginDataDto;
}

// ─── Room ──────────────────────────────────────────────────────────────────────

export class RoomDto {
  @ApiProperty({ example: 'room_x9y8z7', description: 'Unique room identifier' })
  id!: string;

  @ApiProperty({ example: 'general', description: 'Room name' })
  name!: string;

  @ApiProperty({ example: 'ali_123', description: 'Username of the room creator' })
  createdBy!: string;

  @ApiProperty({ example: '2024-03-01T10:00:00.000Z', description: 'Room creation timestamp' })
  createdAt!: string;
}

export class RoomWithActiveUsersDto extends RoomDto {
  @ApiProperty({ example: 4, description: 'Live count of connected users in the room (from Redis)' })
  activeUsers!: number;
}

export class CreateRoomDataDto extends RoomDto {}

export class CreateRoomResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ type: CreateRoomDataDto })
  data!: CreateRoomDataDto;
}

export class GetRoomResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ type: RoomWithActiveUsersDto })
  data!: RoomWithActiveUsersDto;
}

export class RoomListDataDto {
  @ApiProperty({ type: [RoomWithActiveUsersDto], description: 'List of all rooms with active user counts' })
  rooms!: RoomWithActiveUsersDto[];
}

export class RoomListResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ type: RoomListDataDto })
  data!: RoomListDataDto;
}

export class DeleteRoomDataDto {
  @ApiProperty({ example: true, description: 'Indicates the room was successfully deleted' })
  deleted!: boolean;
}

export class DeleteRoomResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ type: DeleteRoomDataDto })
  data!: DeleteRoomDataDto;
}

// ─── Message ───────────────────────────────────────────────────────────────────

export class MessageDto {
  @ApiProperty({ example: 'msg_ab12cd', description: 'Unique message identifier' })
  id!: string;

  @ApiProperty({ example: 'room_x9y8z7', description: 'Room the message belongs to' })
  roomId!: string;

  @ApiProperty({ example: 'ali_123', description: 'Username of the message author' })
  username!: string;

  @ApiProperty({ example: 'hello everyone', description: 'Message content' })
  content!: string;

  @ApiProperty({ example: '2024-03-01T10:05:22.000Z', description: 'Message creation timestamp' })
  createdAt!: string;
}

export class CreateMessageResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ type: MessageDto })
  data!: MessageDto;
}

export class PaginatedMessagesDataDto {
  @ApiProperty({ type: [MessageDto], description: 'Array of message objects' })
  messages!: MessageDto[];

  @ApiProperty({ example: true, description: 'Whether there are more messages before the current page' })
  hasMore!: boolean;

  @ApiProperty({
    example: 'msg_zz9900',
    description: 'Cursor ID for the next page. null when there are no more pages.',
    nullable: true,
  })
  nextCursor!: string | null;
}

export class PaginatedMessagesResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ type: PaginatedMessagesDataDto })
  data!: PaginatedMessagesDataDto;
}
