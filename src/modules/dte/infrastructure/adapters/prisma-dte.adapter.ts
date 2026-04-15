import { Injectable } from '@nestjs/common';
import { DteType as PrismaDteType } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { DteRepository, DteType } from '../../domain/ports/dte-repository.port';
import { DteDocument } from '../../domain/entities/dte-document.entity';

@Injectable()
export class PrismaDteAdapter implements DteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(dte: DteDocument, type: DteType, pdfUrl?: string, rawJson?: object): Promise<void> {
    await this.prisma.dte.upsert({
      where: { generationCode: dte.codigoGeneracion },
      create: {
        generationCode: dte.codigoGeneracion,
        type: this.toPrismaType(type),
        issueDate: dte.fechaEmision,
        receiverNrc: dte.receptorNrc,
        issuerNrc: dte.emisorNrc,
        issuerName: dte.emisorNombre,
        exemptTotal: dte.totalExenta,
        taxableTotal: dte.totalGravada,
        amountDue: dte.totalPagar,
        taxValue: dte.tributosValor,
        pdfUrl: pdfUrl ?? null,
        rawJson: rawJson ?? {},
      },
      update: {
        pdfUrl: pdfUrl ?? undefined,
      },
    });
  }

  async findByGenerationCode(code: string): Promise<DteDocument | null> {
    const record = await this.prisma.dte.findUnique({
      where: { generationCode: code },
    });
    if (!record) return null;
    return new DteDocument(
      record.generationCode,
      record.issueDate,
      record.receiverNrc,
      record.issuerNrc,
      record.issuerName,
      record.exemptTotal,
      record.taxableTotal,
      record.amountDue,
      record.taxValue,
    );
  }

  async findAll(type?: DteType): Promise<DteDocument[]> {
    const records = await this.prisma.dte.findMany({
      where: type ? { type: this.toPrismaType(type) } : undefined,
    });
    return records.map(
      (r) =>
        new DteDocument(
          r.generationCode,
          r.issueDate,
          r.receiverNrc,
          r.issuerNrc,
          r.issuerName,
          r.exemptTotal,
          r.taxableTotal,
          r.amountDue,
          r.taxValue,
        ),
    );
  }

  private toPrismaType(type: DteType): PrismaDteType {
    return type === 'purchase' ? PrismaDteType.purchase : PrismaDteType.sale;
  }
}
