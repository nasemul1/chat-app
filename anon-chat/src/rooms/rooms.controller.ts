import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RoomsService, RoomWithActiveUsers } from './rooms.service';
import { CreateRoomDto } from './dtos/create-room.dto';
import {
  RoomListResponseDto,
  CreateRoomResponseDto,
  GetRoomResponseDto,
  DeleteRoomResponseDto,
  ErrorResponseDto,
} from '../common/dtos/api-responses.dto';

@ApiTags('Rooms')
@ApiBearerAuth()
@Controller('/api/v1/rooms')
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all rooms',
    description:
      'Returns all rooms with live active user counts pulled from Redis, not from the database.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all rooms with active user counts.',
    type: RoomListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or expired session token.',
    type: ErrorResponseDto,
  })
  async getAllRooms(): Promise<{ rooms: RoomWithActiveUsers[] }> {
    const roomsList = await this.roomsService.getAllRooms();
    return { rooms: roomsList };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new room',
    description:
      'Creates a new chat room. Room names must be unique, 3–32 characters, alphanumeric and hyphens only.',
  })
  @ApiBody({ type: CreateRoomDto })
  @ApiResponse({
    status: 201,
    description: 'Room created successfully.',
    type: CreateRoomResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — room name does not meet constraints.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or expired session token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'A room with this name already exists.',
    type: ErrorResponseDto,
  })
  async createRoom(@Body() createRoomDto: CreateRoomDto, @Request() req: any) {
    const room = await this.roomsService.createRoom(
      createRoomDto.name,
      req.user.username,
    );
    return room;
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get room details',
    description:
      'Returns details for a specific room, including the live active user count from Redis.',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique room identifier',
    example: 'room_x9y8z7',
  })
  @ApiResponse({
    status: 200,
    description: 'Room details with active user count.',
    type: GetRoomResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or expired session token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Room not found.',
    type: ErrorResponseDto,
  })
  async getRoomById(@Param('id') id: string): Promise<RoomWithActiveUsers> {
    return this.roomsService.getRoomById(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a room',
    description:
      'Deletes a room and all its messages. Only the room creator can perform this action. A `room:deleted` WebSocket event is emitted to all connected clients in the room before deletion.',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique room identifier',
    example: 'room_x9y8z7',
  })
  @ApiResponse({
    status: 200,
    description: 'Room deleted successfully.',
    type: DeleteRoomResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or expired session token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Only the room creator can delete this room.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Room not found.',
    type: ErrorResponseDto,
  })
  async deleteRoom(@Param('id') id: string, @Request() req: any) {
    await this.roomsService.deleteRoom(id, req.user.username);
    return { deleted: true };
  }
}
