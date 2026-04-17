import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { LinkUserTaxpayerCommand } from './link-user-taxpayer.command';
import { USER_REPOSITORY, UserRepository } from '../../../domain/ports/user-repository.port';
import { TAXPAYER_REPOSITORY, TaxpayerRepository } from '../../../../taxpayer/domain/ports/taxpayer-repository.port';

@CommandHandler(LinkUserTaxpayerCommand)
export class LinkUserTaxpayerHandler implements ICommandHandler<LinkUserTaxpayerCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(TAXPAYER_REPOSITORY) private readonly taxpayerRepository: TaxpayerRepository,
  ) {}

  async execute(command: LinkUserTaxpayerCommand) {
    // 1. actualizar/asegurar que el taxpayer existe con los datos proporcionados
    // nrc es la llave única.
    await this.taxpayerRepository.upsert(command.nrc, {
      nit: command.nit,
      nombre: command.name,
    });

    // 2. buscar taxpayer por nrc para obtener el id interno
    const taxpayer = await this.taxpayerRepository.findByNrc(command.nrc);
    if (!taxpayer) {
      throw new NotFoundException(`Taxpayer with NRC ${command.nrc} not found after upsert`);
    }

    // 3. vincular al usuario
    const updatedUser = await this.userRepository.updateTaxpayerId(command.userId, taxpayer.id);

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      avatarUrl: updatedUser.avatarUrl,
      taxpayer: {
        nrc: taxpayer.nrc,
        nit: taxpayer.nit,
        nombre: taxpayer.nombre,
      },
    };
  }
}

