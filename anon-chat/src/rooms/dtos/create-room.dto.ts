import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @MinLength(3, { message: 'room name must be between 3 and 32 characters' })
  @MaxLength(32, { message: 'room name must be between 3 and 32 characters' })
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message: 'room name must contain only alphanumeric characters and hyphens',
  })
  name!: string;
}
