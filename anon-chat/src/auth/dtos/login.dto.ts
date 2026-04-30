import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Username for authentication. Must be 2–24 characters, alphanumeric and underscores only.',
    example: 'ali_123',
    minLength: 2,
    maxLength: 24,
    pattern: '^[a-zA-Z0-9_]+$',
  })
  @IsString()
  @MinLength(2, { message: 'username must be between 2 and 24 characters' })
  @MaxLength(24, { message: 'username must be between 2 and 24 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username must contain only alphanumeric characters and underscores',
  })
  username!: string;
}
