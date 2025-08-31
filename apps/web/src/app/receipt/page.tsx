import Receipt from "@/components/receipt-test";


export default function Page() {
  const now = new Date();
  const date = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

  return (
    <div className="flex justify-center p-8">
      <Receipt
        date={date}
        time={time}
        travel={{
          from: 'Tangkerang Timur, Tenayan Raya, Pekanbaru, Marpoyan Damai, Riau, Sumatera, 28288, Indonesia',
          to: 'Jalan Pesantren, RW 12, Pematang Kapau, Kulim, Pekanbaru, Pekanbaru Kota, Riau, Sumatera, 28288, Indonesia',
        }}
        passenger={{
          name: 'Budi',
          phone: '0821829386673',
        }}
        fare={{
          distanceKm: 12,
          farePerKm: 6000,
          baseFare: 60000,
          airportCharge: 5000,
        }}
      />
    </div>
  );
}
