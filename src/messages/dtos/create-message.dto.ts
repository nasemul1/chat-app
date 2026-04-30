import { IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateMessageDto {
  @ApiProperty({
    description: "Message content. 1–1000 characters, trimmed server-side.",
    example: "hello everyone",
    minLength: 1,
    maxLength: 1000,
  })
  // Type guard only — length/empty validation is handled by the service so
  // that empty or too-long content returns 422 (not 400) as per the spec.
  @IsOptional()
  @IsString({ message: "content must be a string" })
  content?: string;
}
