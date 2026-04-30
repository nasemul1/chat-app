import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetMessagesQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of messages to return. Default is 50, max is 100.',
    example: 50,
    default: 50,
    minimum: 1,
    maximum: 100,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @ApiPropertyOptional({
    description: 'Message ID cursor — returns messages older than this ID for pagination.',
    example: 'msg_zz9900',
    type: String,
  })
  @IsOptional()
  @IsString()
  before?: string;
}
