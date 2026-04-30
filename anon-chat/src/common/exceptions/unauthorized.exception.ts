import { HttpException, HttpStatus } from '@nestjs/common';

export class UnauthorizedException extends HttpException {
  constructor(message = 'Missing or expired session token') {
    super(
      {
        code: 'UNAUTHORIZED',
        message,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
