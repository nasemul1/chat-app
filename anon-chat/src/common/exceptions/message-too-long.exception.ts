import { HttpException, HttpStatus } from '@nestjs/common';

export class MessageTooLongException extends HttpException {
  constructor() {
    super(
      {
        code: 'MESSAGE_TOO_LONG',
        message: 'Message content must not exceed 1000 characters',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
