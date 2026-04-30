import { Allow, IsOptional } from 'class-validator';

export class CreateMessageDto {
  @IsOptional()
  @Allow()
  content?: string;
}
