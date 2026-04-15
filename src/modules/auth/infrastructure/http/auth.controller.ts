import { Controller, Post, Body } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { LoginWithGoogleCommand } from '../../application/commands/login-with-google/login-with-google.command';

@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('google')
  async googleLogin(@Body('token') token: string) {
    return this.commandBus.execute(new LoginWithGoogleCommand(token));
  }
}
