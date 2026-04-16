import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { TaxpayerRepository, TaxpayerData } from '../../domain/ports/taxpayer-repository.port';

@Injectable()
export class PrismaTaxpayerAdapter implements TaxpayerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(nrc: string, data: TaxpayerData): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (data.codActividad && data.descActividad) {
        await tx.activity.upsert({
          where: { codActividad: data.codActividad },
          create: {
            codActividad: data.codActividad,
            descActividad: data.descActividad,
          },
          update: {
            descActividad: data.descActividad,
          },
        });
      }

      await tx.taxpayer.upsert({
        where: { nrc },
        create: {
          nrc,
          nit: data.nit ?? null,
          nombre: data.nombre,
          nombreComercial: data.nombreComercial ?? null,
          codActividad: data.codActividad ?? null,
          rawJson: data.rawJson ?? null,
        },
        update: {
          nit: data.nit ?? undefined,
          nombre: data.nombre, // always refresh — nombre is required in TaxpayerData
          nombreComercial: data.nombreComercial ?? undefined,
          codActividad: data.codActividad ?? undefined,
          rawJson: data.rawJson ?? undefined,
        },
      });
    });
  }
}
