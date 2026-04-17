import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { TaxpayerRepository, TaxpayerData } from '../../domain/ports/taxpayer-repository.port';

@Injectable()
export class PrismaTaxpayerAdapter implements TaxpayerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(nrc: string, data: TaxpayerData): Promise<void> {
    const cleanNrc = this.sanitizeNrc(nrc);
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
        where: { nrc: cleanNrc },
        create: {
          nrc: cleanNrc,
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

  async findById(id: string): Promise<any | null> {
    const record = await (this.prisma as any).taxpayer.findUnique({
      where: { id },
      include: { activity: true },
    });
    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findByNrc(nrc: string): Promise<any | null> {
    const record = await (this.prisma as any).taxpayer.findUnique({
      where: { nrc: this.sanitizeNrc(nrc) },
      include: { activity: true },
    });
    if (!record) return null;
    return this.mapToDomain(record);
  }

  private sanitizeNrc(nrc: string): string {
    return nrc.replace(/-/g, '');
  }


  private mapToDomain(record: any): any {
    return {
      id: record.id,
      nrc: record.nrc,
      nit: record.nit,
      nombre: record.nombre,
      nombreComercial: record.nombreComercial,
      codActividad: record.codActividad,
      descActividad: record.activity?.descActividad,
      rawJson: record.rawJson as any,
    };
  }
}

