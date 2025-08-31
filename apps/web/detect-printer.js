const escpos = require("escpos");
escpos.USB = require("escpos-usb");

console.log(escpos.USB.findPrinter());
