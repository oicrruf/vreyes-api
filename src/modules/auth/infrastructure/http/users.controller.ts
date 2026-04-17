import { Controller, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiOkResponse, ApiNotFoundResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { LinkUserTaxpayerCommand } from '../../application/commands/link-user-taxpayer/link-user-taxpayer.command';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch('taxpayer')
  @ApiOperation({
    summary: 'Vincular el usuario actual con un contribuyente',
    description: 'Busca un contribuyente por NRC y lo asigna al usuario autenticado (desde el JWT).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['nrc', 'nit', 'name'],
      properties: {
        nrc: { type: 'string', example: '123456-7' },
        nit: { type: 'string', example: '0614-123456-123-1' },
        name: { type: 'string', example: 'Juan Pérez' },
      },
    },
  })
  @ApiOkResponse({ description: 'Usuario actualizado exitosamente' })
  @ApiNotFoundResponse({ description: 'Contribuyente no encontrado' })
  async linkTaxpayer(
    @Req() req: any, 
    @Body('nrc') nrc: string,
    @Body('nit') nit: string,
    @Body('name') name: string,
  ) {
    return this.commandBus.execute(new LinkUserTaxpayerCommand(req.user.id, nrc, nit, name));
  }
}


