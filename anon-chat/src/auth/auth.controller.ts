import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';
import { Public } from '../common/decorators/public.decorator';
import {
  LoginResponseDto,
  ErrorResponseDto,
} from '../common/dtos/api-responses.dto';

@ApiTags('Authentication')
@Controller('/api/v1')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('/login')
  @ApiOperation({
    summary: 'Login / Register',
    description:
      'Get or create a user and return a session token. If the username already exists, returns the existing user with a fresh session token. This endpoint is idempotent by username. Session tokens expire after 24 hours.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Successfully authenticated. Returns a session token and user object.',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — username does not meet constraints.',
    type: ErrorResponseDto,
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.username);
  }
}
