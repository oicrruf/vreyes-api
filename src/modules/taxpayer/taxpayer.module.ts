import { Module } from '@nestjs/common';
import { PrismaTaxpayerAdapter } from './infrastructure/adapters/prisma-taxpayer.adapter';
import { TAXPAYER_REPOSITORY } from './domain/ports/taxpayer-repository.port';

@Module({
  providers: [
    { provide: TAXPAYER_REPOSITORY, useClass: PrismaTaxpayerAdapter },
  ],
  exports: [TAXPAYER_REPOSITORY],
})
export class TaxpayerModule {}
