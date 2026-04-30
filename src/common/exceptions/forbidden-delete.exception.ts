import { HttpException, HttpStatus } from '@nestjs/common';

export class ForbiddenDeleteException extends HttpException {
  constructor() {
    super(
      {
        code: 'FORBIDDEN',
        message: 'Only the room creator can delete this room',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
