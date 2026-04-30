import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({
    description: 'Room name. Must be 3–32 characters, alphanumeric and hyphens only. Must be unique.',
    example: 'general',
    minLength: 3,
    maxLength: 32,
    pattern: '^[a-zA-Z0-9-]+$',
  })
  @IsString()
  @MinLength(3, { message: 'room name must be between 3 and 32 characters' })
  @MaxLength(32, { message: 'room name must be between 3 and 32 characters' })
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message: 'room name must contain only alphanumeric characters and hyphens',
  })
  name!: string;
}
