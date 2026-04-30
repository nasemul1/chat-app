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
import { RoomsService, RoomWithActiveUsers } from './rooms.service';
import { CreateRoomDto } from './dtos/create-room.dto';

@Controller('/api/v1/rooms')
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  @Get()
  async getAllRooms(): Promise<{ rooms: RoomWithActiveUsers[] }> {
    const roomsList = await this.roomsService.getAllRooms();
    return { rooms: roomsList };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createRoom(@Body() createRoomDto: CreateRoomDto, @Request() req: any) {
    const room = await this.roomsService.createRoom(
      createRoomDto.name,
      req.user.username,
    );
    return room;
  }

  @Get(':id')
  async getRoomById(@Param('id') id: string): Promise<RoomWithActiveUsers> {
    return this.roomsService.getRoomById(id);
  }

  @Delete(':id')
  async deleteRoom(@Param('id') id: string, @Request() req: any) {
    await this.roomsService.deleteRoom(id, req.user.username);
    return { deleted: true };
  }
}
