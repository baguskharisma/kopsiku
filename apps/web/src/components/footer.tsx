import Link from "next/link"
import Image from "next/image"
import { MapPin, Phone, Mail, Clock, Facebook, Instagram, Twitter } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Image
                src="/images/logo-kopsi-pekanbaru.jpeg"
                alt="KOPSI Pekanbaru"
                width={40}
                height={40}
                className="rounded-full"
              />
              <span className="text-xl font-bold">KOPSI Pekanbaru</span>
            </div>
            <p className="text-gray-300 text-sm">
              Koperasi Pengemudi Taxi Pekanbaru yang menyediakan layanan transportasi travel dan taksi terpercaya di Riau
              dan sekitarnya.
            </p>
            <div className="flex space-x-4">
              <Link href="#" className="text-gray-400 hover:text-white">
                <Facebook className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white">
                <Instagram className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white">
                <Twitter className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* Services */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Layanan Kami</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/tickets" className="text-gray-300 hover:text-white">
                  Tiket Travel Antar Kota
                </Link>
              </li>
              <li>
                <Link href="/tours" className="text-gray-300 hover:text-white">
                  Paket Wisata Riau
                </Link>
              </li>
              <li>
                <Link href="/taxi" className="text-gray-300 hover:text-white">
                  Taksi Online 24/7
                </Link>
              </li>
              <li>
                <Link href="/charter" className="text-gray-300 hover:text-white">
                  Sewa Kendaraan
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Kontak</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start space-x-3">
                <MapPin className="h-4 w-4 mt-0.5 text-gray-400" />
                <span className="text-gray-300">
                  Jl. Jenderal Sudirman No. 123
                  <br />
                  Pekanbaru, Riau 28116
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-gray-300">+62 761 123 4567</span>
              </div>
              <div className="flex items-center space-x-3">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-gray-300">info@kopsipekanbaru.com</span>
              </div>
              <div className="flex items-start space-x-3">
                <Clock className="h-4 w-4 mt-0.5 text-gray-400" />
                <span className="text-gray-300">
                  Senin - Minggu
                  <br />
                  06:00 - 22:00 WIB
                </span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Tautan Cepat</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="text-gray-300 hover:text-white">
                  Tentang Kami
                </Link>
              </li>
              <li>
                <Link href="/profile/orders" className="text-gray-300 hover:text-white">
                  Riwayat Pesanan
                </Link>
              </li>
              <li>
                <Link href="/help" className="text-gray-300 hover:text-white">
                  Bantuan
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-300 hover:text-white">
                  Syarat & Ketentuan
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-300 hover:text-white">
                  Kebijakan Privasi
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
          <p>&copy; 2025 PT Scuderia Hive Digital. Semua hak dilindungi undang-undang.</p>
        </div>
      </div>
    </footer>
  )
}
