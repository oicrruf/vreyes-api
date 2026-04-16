import { Injectable } from '@nestjs/common';
import { DteType as PrismaDteType } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { DteRepository, DteRecord, DteType } from '../../domain/ports/dte-repository.port';
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
        receiverNrc: dte.receptorNrc || null,
        issuerNrc: dte.emisorNrc,
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

  async updateClassification(
    generationCode: string,
    itemsCategory: string[],
  ): Promise<void> {
    await this.prisma.dte.update({
      where: { generationCode },
      data: {
        itemsCategory,
      },
    });
  }

  async findByGenerationCode(code: string): Promise<DteDocument | null> {
    const record = await this.prisma.dte.findUnique({
      where: { generationCode: code },
      include: { issuer: true, receiver: true }
    });
    if (!record) return null;
    return new DteDocument(
      record.generationCode,
      record.issueDate,
      record.receiverNrc || '',
      record.receiver?.nombre || '',
      record.issuerNrc,
      record.issuer.nombre,
      record.exemptTotal,
      record.taxableTotal,
      record.amountDue,
      record.taxValue,
    );
  }

  async findAll(type?: DteType): Promise<DteDocument[]> {
    const records = await this.prisma.dte.findMany({
      where: type ? { type: this.toPrismaType(type) } : undefined,
      include: { issuer: true, receiver: true }
    });
    return records.map(
      (r) =>
        new DteDocument(
          r.generationCode,
          r.issueDate,
          r.receiverNrc || '',
          r.receiver?.nombre || '',
          r.issuerNrc,
          r.issuer.nombre,
          r.exemptTotal,
          r.taxableTotal,
          r.amountDue,
          r.taxValue,
        ),
    );
  }

  async findByPeriod(year: number, month: number, type: DteType): Promise<DteRecord[]> {
    const monthStr = month.toString().padStart(2, '0');
    const prefix = `${year}-${monthStr}`;

    const records = await this.prisma.dte.findMany({
      where: {
        type: this.toPrismaType(type),
        issueDate: { startsWith: prefix },
      },
      include: {
        issuer: {
          include: { activity: true },
        },
        receiver: true,
      },
      orderBy: { issueDate: 'asc' },
    });

    return records.map((r) => ({
      generationCode: r.generationCode,
      type,
      issueDate: r.issueDate,
      receiverNrc: r.receiverNrc,
      receiverName: r.receiver?.nombre ?? null,
      issuerNrc: r.issuerNrc,
      issuerName: r.issuer.nombre,
      issuerActivity: r.issuer.activity?.descActividad ?? null,
      exemptTotal: r.exemptTotal,
      taxableTotal: r.taxableTotal,
      amountDue: r.amountDue,
      taxValue: r.taxValue,
      pdfUrl: r.pdfUrl,
      itemsCategory: Array.isArray(r.itemsCategory) ? (r.itemsCategory as string[]) : null,
      createdAt: r.createdAt,
    }));
  }

  async findRawJson(generationCode: string): Promise<object | null> {
    const record = await this.prisma.dte.findUnique({
      where: { generationCode },
      select: { rawJson: true },
    });
    if (!record) return null;
    return record.rawJson as object;
  }

  private toPrismaType(type: DteType): PrismaDteType {
    return type === 'purchase' ? PrismaDteType.purchase : PrismaDteType.sale;
  }
}
