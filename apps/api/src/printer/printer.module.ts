import { Module } from '@nestjs/common';
import { TaxiPrinterService } from './printer.service';
import { TaxiPrinterController } from './printer.controller';

@Module({
  controllers: [TaxiPrinterController],
  providers: [TaxiPrinterService],
  exports: [TaxiPrinterService]
})
export class PrinterModule {}