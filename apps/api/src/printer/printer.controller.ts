import { Controller, Post, Body } from '@nestjs/common';
import { TaxiPrinterService } from './printer.service';

@Controller('printer')
export class TaxiPrinterController {
  constructor(private readonly printerService: TaxiPrinterService) {}

  @Post('print')
  async printReceipt(@Body() body) {
    return this.printerService.printReceipt(body);
  }
}
