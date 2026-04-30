import { HttpException, HttpStatus } from "@nestjs/common";

export class MessageTooLongException extends HttpException {
  constructor(message = "Message content must not exceed 1000 characters") {
    super(
      {
        code: "MESSAGE_TOO_LONG",
        message,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
