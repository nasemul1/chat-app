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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dtos/create-message.dto';
import { GetMessagesQueryDto } from './dtos/get-messages.query.dto';
import {
  PaginatedMessagesResponseDto,
  CreateMessageResponseDto,
  ErrorResponseDto,
} from '../common/dtos/api-responses.dto';

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('/api/v1/rooms/:id/messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get paginated message history',
    description:
      'Returns paginated messages for a room, ordered newest first. Use the `before` cursor for pagination. `nextCursor` is `null` when there are no more pages.',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique room identifier',
    example: 'room_x9y8z7',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of messages with cursor info.',
    type: PaginatedMessagesResponseDto,
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
  async getRoomMessages(
    @Param('id') roomId: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.messagesService.getRoomMessages(roomId, query.limit, query.before);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send a message',
    description:
      'Sends a message to a room. The message is persisted to the database and then broadcast to all clients via Redis pub/sub (`message:new` event). Content is trimmed server-side and must be 1–1000 characters.',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique room identifier',
    example: 'room_x9y8z7',
  })
  @ApiBody({ type: CreateMessageDto })
  @ApiResponse({
    status: 201,
    description: 'Message sent successfully.',
    type: CreateMessageResponseDto,
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
  @ApiResponse({
    status: 422,
    description: 'Content is empty or exceeds 1000 characters.',
    type: ErrorResponseDto,
  })
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
