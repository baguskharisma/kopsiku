import Link from "next/link"
import Image from "next/image"
import { MapPin, Phone, Mail, Facebook, Twitter, Instagram, Youtube, Car, Clock, Shield, Star } from "lucide-react"

export function FooterTaxi() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 flex items-center justify-center">
                <Image
                  src="/images/logo-kopsi-pekanbaru.jpeg"
                  width={48}
                  height={48}
                  alt="Logo KOPSI Pekanbaru"
                  className="rounded-lg object-contain"
                />
              </div>
              <div>
                <h3 className="text-xl font-bold">Taxi KOPSI Pekanbaru</h3>
                <p className="text-sm text-gray-400">Layanan Taksi Terpercaya</p>
              </div>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              Layanan taksi online 24/7 dengan armada Toyota terpercaya. Kami berkomitmen memberikan perjalanan yang
              aman, nyaman, dan tepat waktu untuk setiap kebutuhan transportasi Anda di Pekanbaru.
            </p>
            <div className="flex space-x-4">
              <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                <Facebook className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                <Twitter className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                <Instagram className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                <Youtube className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* Taxi Services */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Layanan Taksi</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/taxi"
                  className="text-gray-300 hover:text-white transition-colors text-sm flex items-center"
                >
                  <Car className="h-4 w-4 mr-2" />
                  Pesan Taksi Online
                </Link>
              </li>
              <li>
                <Link
                  href="/taxi/schedule"
                  className="text-gray-300 hover:text-white transition-colors text-sm flex items-center"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Jadwal Perjalanan
                </Link>
              </li>
              <li>
                <Link
                  href="/taxi/rates"
                  className="text-gray-300 hover:text-white transition-colors text-sm flex items-center"
                >
                  <Star className="h-4 w-4 mr-2" />
                  Tarif & Estimasi
                </Link>
              </li>
              <li>
                <Link
                  href="/taxi/safety"
                  className="text-gray-300 hover:text-white transition-colors text-sm flex items-center"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Keamanan & Asuransi
                </Link>
              </li>
              <li>
                <Link href="/taxi/fleet" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Armada Toyota
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Bantuan Taksi</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/taxi/help" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Cara Pesan Taksi
                </Link>
              </li>
              <li>
                <Link href="/taxi/tracking" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Lacak Perjalanan
                </Link>
              </li>
              <li>
                <Link href="/taxi/payment" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Metode Pembayaran
                </Link>
              </li>
              <li>
                <Link href="/taxi/cancel" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Pembatalan Pesanan
                </Link>
              </li>
              <li>
                <Link href="/taxi/complaint" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Laporan & Keluhan
                </Link>
              </li>
            </ul>
          </div>

          {/* Emergency Contact */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Kontak Darurat</h4>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-300">
                    Kantor Pusat Taksi KOPSI
                    <br />
                    Jl. Sudirman No. 123
                    <br />
                    Pekanbaru, Riau 28116
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-300 font-medium">Hotline 24/7</p>
                  <p className="text-sm text-gray-300">+62 761 TAKSI (82574)</p>
                  <p className="text-sm text-gray-300">+62 812 KOPSI (56774)</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-300">taksi@kopsipekanbaru.id</p>
                  <p className="text-sm text-gray-300">emergency@kopsipekanbaru.id</p>
                </div>
              </div>
            </div>

            {/* Emergency Button */}
            <div className="pt-2">
              <Link href="tel:+6276182574">
                <button className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm">
                  🚨 Panggilan Darurat
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-sm text-gray-400">
              © 2025 Taxi KOPSI Pekanbaru - PT Scuderia Hive Digital. Layanan taksi berlisensi resmi.
            </div>
            <div className="flex space-x-6 text-sm">
              <Link href="/taxi/terms" className="text-gray-400 hover:text-white transition-colors">
                Syarat Layanan Taksi
              </Link>
              <Link href="/taxi/privacy" className="text-gray-400 hover:text-white transition-colors">
                Privasi Penumpang
              </Link>
              <Link href="/taxi/insurance" className="text-gray-400 hover:text-white transition-colors">
                Asuransi Perjalanan
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
