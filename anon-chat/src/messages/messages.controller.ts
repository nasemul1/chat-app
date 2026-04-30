import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dtos/create-message.dto';
import { GetMessagesQueryDto } from './dtos/get-messages.query.dto';

@Controller('/api/v1/rooms/:id/messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get()
  async getRoomMessages(
    @Param('id') roomId: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.messagesService.getRoomMessages(roomId, query.limit, query.before);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createMessage(
    @Param('id') roomId: string,
    @Body() createMessageDto: CreateMessageDto,
    @Request() req: any,
  ) {
    return this.messagesService.createMessage(
      roomId,
      req.user.username,
      createMessageDto.content,
    );
  }
}
