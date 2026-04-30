import { Controller, Get, Param, Render, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { Response } from 'express';

@ApiExcludeController()
@Controller()
export class FrontendController {
  @Public()
  @Get('/')
  loginPage(@Res() res: Response) {
    return res.render('login');
  }

  @Public()
  @Get('/rooms')
  roomsPage(@Res() res: Response) {
    return res.render('rooms');
  }

  @Public()
  @Get('/chat/:roomId')
  chatPage(@Param('roomId') roomId: string, @Res() res: Response) {
    return res.render('chat', { roomId });
  }
}
