import { HttpException, HttpStatus } from '@nestjs/common';

export class RoomNameTakenException extends HttpException {
  constructor() {
    super(
      {
        code: 'ROOM_NAME_TAKEN',
        message: 'A room with this name already exists',
      },
      HttpStatus.CONFLICT,
    );
  }
}
