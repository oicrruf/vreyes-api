import { Controller, Post, Body } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiBody, ApiOkResponse, ApiBadRequestResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { LoginWithGoogleCommand } from '../../application/commands/login-with-google/login-with-google.command';

class GoogleLoginDto {
  token: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('google')
  @ApiOperation({
    summary: 'Login con Google',
    description: 'Verifica un ID token de Google OAuth2. Si el usuario no existe lo crea. Retorna un JWT de la API junto con el perfil del usuario.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['token'],
      properties: {
        token: {
          type: 'string',
          description: 'ID token obtenido del flujo de Google OAuth2 en el cliente',
          example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Login exitoso. Retorna JWT y datos del usuario.',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          description: 'JWT firmado para usar en endpoints protegidos',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', example: 'usuario@gmail.com' },
            name: { type: 'string', example: 'Juan Pérez' },
            avatarUrl: { type: 'string', nullable: true, example: 'https://lh3.googleusercontent.com/...' },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Token de Google inválido o expirado.' })
  @ApiBadRequestResponse({ description: 'El campo `token` es requerido.' })
  async googleLogin(@Body('token') token: string) {
    return this.commandBus.execute(new LoginWithGoogleCommand(token));
  }
}
