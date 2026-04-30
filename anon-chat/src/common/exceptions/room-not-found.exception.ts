import { HttpException, HttpStatus } from '@nestjs/common';

export class RoomNotFoundException extends HttpException {
  constructor(roomId: string) {
    super(
      {
        code: 'ROOM_NOT_FOUND',
        message: `Room with id ${roomId} does not exist`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
