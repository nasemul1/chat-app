import { Allow, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({
    description: 'Message content. 1–1000 characters, trimmed server-side.',
    example: 'hello everyone',
    minLength: 1,
    maxLength: 1000,
    required: false,
  })
  @IsOptional()
  @Allow()
  content?: string;
}
