import { Injectable, Logger } from '@nestjs/common';
import { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } from 'node-thermal-printer';

@Injectable()
export class TaxiPrinterService {
  private readonly logger = new Logger(TaxiPrinterService.name);

  private printer: ThermalPrinter;

  constructor() {
    this.printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,                
      interface: 'tcp://192.168.0.101',
      characterSet: CharacterSet.PC852_LATIN2,
      removeSpecialCharacters: false,
      lineCharacter: '-',
      breakLine: BreakLine.WORD,
      options: {
        timeout: 5000,
      },
    });
  }

  async printReceipt(data: {
    distance: number;
    duration: number;
    baseFare: number;
    additionalFare: number;
    airportFare: number;
    totalFare: number;
  }) {
    try {
      const isConnected = await this.printer.isPrinterConnected();
      if (!isConnected) {
        this.logger.error('❌ Printer not connected');
        throw new Error('Printer not connected');
      }

      this.printer.clear();

      this.printer.alignCenter();
      this.printer.setTextQuadArea();
      this.printer.println("TAXI RECEIPT");
      this.printer.setTextNormal();
      this.printer.newLine();

      this.printer.alignLeft();
      this.printer.tableCustom([
        { text: "Distance", align: "LEFT", width: 0.5 },
        { text: `${data.distance.toFixed(2)} km`, align: "RIGHT", width: 0.5 }
      ]);
      this.printer.tableCustom([
        { text: "Duration", align: "LEFT", width: 0.5 },
        { text: `${data.duration} min`, align: "RIGHT", width: 0.5 }
      ]);
      this.printer.tableCustom([
        { text: "Base Fare", align: "LEFT", width: 0.5 },
        { text: `Rp ${data.baseFare.toLocaleString()}`, align: "RIGHT", width: 0.5 }
      ]);
      this.printer.tableCustom([
        { text: "Additional", align: "LEFT", width: 0.5 },
        { text: `Rp ${data.additionalFare.toLocaleString()}`, align: "RIGHT", width: 0.5 }
      ]);
      this.printer.tableCustom([
        { text: "Airport", align: "LEFT", width: 0.5 },
        { text: `Rp ${data.airportFare.toLocaleString()}`, align: "RIGHT", width: 0.5 }
      ]);

      this.printer.drawLine();

      this.printer.alignLeft();
      this.printer.bold(true);
      this.printer.tableCustom([
        { text: "TOTAL", align: "LEFT", width: 0.5 },
        { text: `Rp ${data.totalFare.toLocaleString()}`, align: "RIGHT", width: 0.5 }
      ]);
      this.printer.bold(false);

      this.printer.newLine();
      this.printer.alignCenter();
      this.printer.println("Thank you for riding with us!");
      this.printer.newLine();

      this.printer.cut();

      const execute = await this.printer.execute();
      this.logger.log("✅ Print executed:", execute);
      return { success: true, message: "Receipt printed successfully" };
    } catch (err) {
      this.logger.error("❌ Print failed", err);
      throw err;
    }
  }
}
