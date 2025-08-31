'use client';

import Image from 'next/image';
import React from 'react';

interface TravelDetail {
  from: string;
  to: string;
}

interface PassengerDetail {
  name: string;
  phone: string;
}

interface FareDetail {
  distanceKm: number;
  farePerKm: number;
  baseFare: number;
  airportCharge: number;
}

interface ReceiptProps {
  date: string;           // e.g. "30 Agustus 2025"
  time: string;           // e.g. "22:56 WIB"
  travel: TravelDetail;
  passenger: PassengerDetail;
  fare: FareDetail;
  waitingChargeNote?: string; // optional observasi
  // path relatif dari folder `public`, mulai dengan '/' mis. '/qrcode.png'
  qrSrc?: string;
  // ukuran (px) QR yang ingin ditampilkan (square)
  qrSize?: number;
}

const Receipt: React.FC<ReceiptProps> = ({
  date,
  time,
  travel,
  passenger,
  fare,
  waitingChargeNote = 'Penumpang akan dibebankan biaya tunggu sebesar Rp 45.000 apabila singgah lebih dari 15 menit atau merubah tujuan perjalanan dalam kota Pekanbaru.',
  qrSrc = '/qrcode.png',
  qrSize = 120,
}) => {
  const subtotal = fare.distanceKm * fare.farePerKm;
  const total = subtotal + fare.baseFare + fare.airportCharge;

  return (
    <div className="receipt-container font-sans max-w-xs p-4 border rounded shadow">
      <div className="header text-center mb-4 flex justify-between items-center">
        <div className="text-[8px] -mt-10">{date}</div>
        <div>
            <Image
                src='/logo-kopsi-pekanbaru.jpeg'
                alt="Logo KOPSI Pekanbaru"
                width={50}
                height={50}
                className='mx-auto'
            />
            <h2 className="text-sm font-bold">KOPSI PEKANBARU</h2>
        </div>
        <div className="text-[8px] -mt-10">{time}</div>
      </div>

      <section className="mb-3">
        <h3 className="font-semibold text-sm">Detail Perjalanan :</h3>
        <p className='text-xs'><strong>Dari :</strong> {travel.from}</p>
        <p className='text-xs'><strong>Tujuan:</strong> {travel.to}</p>
      </section>

      <section className="mb-3">
        <h3 className="font-semibold text-sm">Detail Penumpang :</h3>
        <div className='flex justify-between text-xs'><strong>Nama Penumpang</strong> <strong>{passenger.name}</strong></div>
        <div className='flex justify-between text-xs'><strong>Nomor Handphone</strong> <strong>{passenger.phone}</strong></div>
      </section>

      <section className="mb-3">
        <h3 className="font-semibold text-sm">Detail Tarif :</h3>
        <div className='flex justify-between text-xs'><strong>Jarak Tempuh (KM)</strong> {fare.distanceKm}</div>
        <div className='flex justify-between text-xs'><strong>Tarif Per KM</strong> Rp {fare.farePerKm.toLocaleString()}</div>
        <div className='flex justify-between w-1/2 ms-auto text-xs'><strong>Subtotal</strong> <strong> Rp {subtotal.toLocaleString()}</strong></div>
        <div className='flex justify-between text-xs'><strong>Tarif Dasar</strong> Rp {fare.baseFare.toLocaleString()}</div>
        <div className='flex justify-between text-xs'><strong>Airport Charge</strong> Rp {fare.airportCharge.toLocaleString()}</div>
        <div className="flex justify-between w-1/2 ms-auto text-xs"><strong>TOTAL</strong> <strong> Rp {total.toLocaleString()}</strong></div>
      </section>

      {/* QR code placeholder */}
      <div className="qr-code mb-3 flex justify-center">
        {/* pastikan qrSrc mengarah ke file di folder public, misal '/qrcode.png' */}
        <Image
          src={qrSrc}
          alt="QR Code"
          width={qrSize}
          height={qrSize}
          priority
        />
      </div>

      <footer className="text-[10px] text-gray-600">
        <em>Catatan: {waitingChargeNote}</em>
      </footer>
    </div>
  );
};

export default Receipt;
