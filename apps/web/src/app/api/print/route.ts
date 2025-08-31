import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { distance, duration, baseFare, additionalFare, airportFare, totalFare } = body;

    // require di dalam scope (supaya tidak dibundle Webpack)
    const escpos = require("escpos");
    escpos.USB = require("escpos-usb");

    const device = new escpos.USB();
    const printer = new escpos.Printer(device);

    device.open(function () {
      printer
        .align("ct")
        .text("=== Ride Receipt ===")
        .align("lt")
        .text(`Distance       : ${distance} km`)
        .text(`Estimated Time : ${duration} minutes`)
        .text(`Base Fare      : Rp ${baseFare.toLocaleString()}`)
        .text(`Additional     : Rp ${additionalFare.toLocaleString()}`)
        .text(`Airport Fare   : Rp ${airportFare.toLocaleString()}`)
        .text("--------------------------")
        .align("ct")
        .text(`Total: Rp ${totalFare.toLocaleString()}`)
        .newline()
        .text("Terima kasih!")
        .cut()
        .close();
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Print error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
