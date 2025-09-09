'use client'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Clock, Users, Star, Ticket, Package, Car, Shield, Filter } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { HeroCarousel } from "@/components/hero-carousel"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
// import { getUserRole } from "@/lib/validations/auth"
import { getUser } from "../actions/getUser"

export default function HomePage() {
  // const [role, setRole] = useState<string | null>(null);
  // const router = useRouter();

  // useEffect(() => {
  //   (async () => {
  //     const user = await getUser();
  //     console.log("User from API:", user);
  //     setRole(user?.role ?? null);

  //     if (!user || user.role !== "ADMIN") {
  //       router.replace("/");
  //     }
  //   })();
  // }, [router]);

  // if (!role) return <p>Loading...</p>;
  // return <div>Halo Admin! Role kamu: {role}</div>;

  const carouselImages = [
    {
      src: "/images/hero-carousel-2.jpeg",
      alt: "KOPSI Pekanbaru Fleet - Toyota Fortuner & Innova",
      title: "Armada Premium KOPSI",
      subtitle: "Toyota Fortuner & Innova untuk kenyamanan perjalanan travel Anda",
    },
    {
      src: "/images/hero-carousel-1.png",
      alt: "KOPSI Yellow Taxi - Professional Service",
      title: "Taksi Resmi KOPSI",
      subtitle: "Layanan taksi profesional dengan armada terawat dan driver berpengalaman",
    },
    {
      src: "/images/hero-carousel-3.jpeg",
      alt: "KOPSI Taxi Fleet - Reliable Transportation",
      title: "Transportasi Terpercaya",
      subtitle: "Melayani kebutuhan transportasi harian Anda di Pekanbaru dan sekitarnya",
    },
  ]

  const featuredTickets = [
    {
      id: 1,
      from: "Pekanbaru",
      to: "Dumai",
      price: "Rp 85.000",
      duration: "2.5 jam",
      departure: "07:00",
      seats: 15,
      rating: 4.8,
      image: "/pekanbaru-dumai-bus.png",
      distance: "188 km",
      landmarks: ["Pelabuhan Dumai", "Pantai Rupat"],
    },
    {
      id: 2,
      from: "Pekanbaru",
      to: "Bangkinang",
      price: "Rp 45.000",
      duration: "1.5 jam",
      departure: "08:30",
      seats: 12,
      rating: 4.9,
      image: "/pekanbaru-bangkinang-bus.png",
      distance: "62 km",
      landmarks: ["Masjid Agung Bangkinang", "Danau Buatan Bangkinang"],
    },
    {
      id: 3,
      from: "Pekanbaru",
      to: "Tembilahan",
      price: "Rp 95.000",
      duration: "3 jam",
      departure: "09:00",
      seats: 18,
      rating: 4.7,
      image: "/pekanbaru-tembilahan-bus.png",
      distance: "156 km",
      landmarks: ["Sungai Indragiri", "Pasar Tembilahan"],
    },
    {
      id: 4,
      from: "Pekanbaru",
      to: "Rengat",
      price: "Rp 120.000",
      duration: "4 jam",
      departure: "06:30",
      seats: 10,
      rating: 4.6,
      image: "/pekanbaru-rengat-bus.png",
      distance: "198 km",
      landmarks: ["Museum Sang Nila Utama", "Jembatan Rengat"],
    },
    {
      id: 5,
      from: "Pekanbaru",
      to: "Bagan Siapi-api",
      price: "Rp 110.000",
      duration: "3.5 jam",
      departure: "07:30",
      seats: 14,
      rating: 4.8,
      image: "/pekanbaru-bagansiapiapi-bus.png",
      distance: "174 km",
      landmarks: ["Pelabuhan Bagan Siapi-api", "Pantai Bagansiapiapi"],
    },
    {
      id: 6,
      from: "Pekanbaru",
      to: "Pasir Pengaraian",
      price: "Rp 75.000",
      duration: "2 jam",
      departure: "10:00",
      seats: 16,
      rating: 4.5,
      image: "/pekanbaru-pasirpengaraian-bus.png",
      distance: "98 km",
      landmarks: ["Danau Napangga", "Hutan Wisata Rokan Hulu"],
    },
  ]

  const tourPackages = [
    {
      id: 1,
      title: "Wisata Pulau Rupat 2D1N",
      price: "Rp 650.000",
      duration: "2 hari 1 malam",
      rating: 4.9,
      image: "/pulau-rupat-beach.png",
      highlights: ["Pantai Tanjung Punak", "Desa Wisata Tanjung Medang", "Sunset Point"],
    },
    {
      id: 2,
      title: "Explore Siak Sri Indrapura 1D",
      price: "Rp 350.000",
      duration: "1 hari",
      rating: 4.8,
      image: "/siak-palace-tour.png",
      highlights: ["Istana Siak", "Masjid Raya Siak", "Museum Istana Siak"],
    },
    {
      id: 3,
      title: "Danau Napangga Adventure 2D1N",
      price: "Rp 480.000",
      duration: "2 hari 1 malam",
      rating: 4.7,
      image: "/danau-napangga-view.png",
      highlights: ["Danau Napangga", "Hutan Wisata", "Camping Ground"],
    },
  ]

  const riauDestinations = [
    { name: "Dumai", distance: "188 km", time: "2.5 jam", type: "Kota Pelabuhan" },
    { name: "Bangkinang", distance: "62 km", time: "1.5 jam", type: "Kota Kabupaten" },
    { name: "Tembilahan", distance: "156 km", time: "3 jam", type: "Kota Sungai" },
    { name: "Rengat", distance: "198 km", time: "4 jam", type: "Kota Sejarah" },
    { name: "Bagan Siapi-api", distance: "174 km", time: "3.5 jam", type: "Kota Nelayan" },
    { name: "Pasir Pengaraian", distance: "98 km", time: "2 jam", type: "Kota Wisata Alam" },
  ]

  return (
    <div className="min-h-screen">
      {/* <div>Halo Admin! Role kamu: {role}</div>; */}
      {/* Hero Section with Dynamic Carousel */}
      <HeroCarousel images={carouselImages} autoPlayInterval={7000}>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-white drop-shadow-2xl text-shadow-lg">
            Pesan Taxi dan Tiket Perjalanan Online
          </h1>
          <div>
            <Image
                src='/logo-kopsiku.png'
                alt="Logo Kopsiku"
                width={300}
                height={300}
                className='mx-auto'
            />
          </div>
          <p className="text-xl md:text-2xl lg:text-3xl mb-8 text-white/95 drop-shadow-lg max-w-3xl mx-auto leading-relaxed">
            Nikmati perjalanan nyaman ke seluruh destinasi di Riau dengan layanan travel dan taksi terpercaya
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
            <Link href="/tickets">
              <Button
                size="lg"
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-8 py-4 text-lg shadow-2xl hover:shadow-yellow-500/25 transition-all duration-300 transform hover:scale-105"
              >
                <Ticket className="mr-2 h-6 w-6" />
                Pesan Tiket Travel
              </Button>
            </Link>
            <Link href="/taxi">
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-white text-white hover:bg-white hover:text-blue-800 px-8 py-4 text-lg bg-white/10 backdrop-blur-sm shadow-2xl hover:shadow-white/25 transition-all duration-300 transform hover:scale-105"
              >
                <Car className="mr-2 h-6 w-6" />
                Pesan Taksi Online
              </Button>
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-white/90">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400">15+</div>
              <div className="text-sm">Tahun Pengalaman</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400">50+</div>
              <div className="text-sm">Armada Berkualitas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400">100K+</div>
              <div className="text-sm">Pelanggan Puas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400">24/7</div>
              <div className="text-sm">Layanan Siaga</div>
            </div>
          </div>
        </div>
      </HeroCarousel>

      {/* Riau Destinations Overview */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Destinasi Populer di Riau</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Temukan berbagai destinasi menarik di Provinsi Riau dengan akses mudah dari Pekanbaru
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {riauDestinations.map((destination, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">{destination.name}</h3>
                    <Badge variant="outline">{destination.type}</Badge>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span>{destination.distance} dari Pekanbaru</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      <span>Waktu tempuh: {destination.time}</span>
                    </div>
                  </div>
                  <Link href={`/tickets?destination=${destination.name.toLowerCase()}`}>
                    <Button className="w-full mt-4 bg-transparent" variant="outline">
                      Lihat Jadwal Travel
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Layanan Kami</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Kami menyediakan berbagai layanan transportasi untuk memenuhi kebutuhan perjalanan Anda di Riau
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Ticket className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle>Travel Antar Kota</CardTitle>
                <CardDescription>Perjalanan nyaman ke seluruh kota di Riau</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• Rute lengkap se-Riau</li>
                  <li>• Armada terawat & AC</li>
                  <li>• Driver berpengalaman</li>
                  <li>• Harga terjangkau</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle>Paket Wisata Riau</CardTitle>
                <CardDescription>Paket tour lengkap destinasi wisata Riau</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• Wisata alam & budaya</li>
                  <li>• Guide lokal berpengalaman</li>
                  <li>• Akomodasi terpilih</li>
                  <li>• Dokumentasi gratis</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Car className="h-8 w-8 text-yellow-600" />
                </div>
                <CardTitle>Taksi Pekanbaru</CardTitle>
                <CardDescription>Layanan taksi 24/7 di Pekanbaru dan sekitarnya</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• Booking online mudah</li>
                  <li>• GPS tracking real-time</li>
                  <li>• Tarif transparan</li>
                  <li>• Driver terverifikasi</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Featured Tickets */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Rute Travel Populer</h2>
              <p className="text-xl text-gray-600">Destinasi favorit di Riau dengan harga terbaik</p>
            </div>
            <Link href="/tickets">
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Lihat Semua Rute
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredTickets.map((ticket) => (
              <Card key={ticket.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative h-48">
                  <Image
                    src={ticket.image || "/placeholder.svg"}
                    alt={`${ticket.from} to ${ticket.to}`}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white text-gray-900">
                      <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                      {ticket.rating}
                    </Badge>
                  </div>
                  <div className="absolute bottom-4 left-4">
                    <Badge variant="secondary" className="bg-blue-600 text-white">
                      {ticket.distance}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {ticket.from} → {ticket.to}
                      </h3>
                      <p className="text-2xl font-bold text-blue-600">{ticket.price}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      {ticket.duration} • Berangkat {ticket.departure}
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      {ticket.seats} kursi tersedia
                    </div>
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2" />
                      {ticket.landmarks.join(", ")}
                    </div>
                  </div>
                  <Link href={`/details/${ticket.id}`}>
                    <Button className="w-full">Pesan Sekarang</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Tour Packages */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Paket Wisata Riau Terbaik</h2>
              <p className="text-xl text-gray-600">Jelajahi keindahan alam dan budaya Riau</p>
            </div>
            <Link href="/tours">
              <Button variant="outline">Lihat Semua Paket</Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tourPackages.map((tour) => (
              <Card key={tour.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative h-64">
                  <Image src={tour.image || "/placeholder.svg"} alt={tour.title} fill className="object-cover" />
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white text-gray-900">
                      <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                      {tour.rating}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-2">{tour.title}</h3>
                  <p className="text-gray-600 mb-4">{tour.duration}</p>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">Highlights:</p>
                    <div className="flex flex-wrap gap-1">
                      {tour.highlights.map((highlight, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {highlight}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-bold text-green-600">{tour.price}</p>
                    <Link href={`/tours/${tour.id}`}>
                      <Button>Lihat Detail</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Mengapa Memilih KOPSI Pekanbaru?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Kami berkomitmen memberikan pelayanan terbaik dengan pengetahuan lokal yang mendalam
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Aman & Terpercaya</h3>
              <p className="text-gray-600 text-sm">
                Driver lokal berpengalaman dengan pengetahuan rute terbaik di Riau
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Tepat Waktu</h3>
              <p className="text-gray-600 text-sm">Jadwal keberangkatan konsisten dengan estimasi waktu yang akurat</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8 text-yellow-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Pelayanan Prima</h3>
              <p className="text-gray-600 text-sm">Customer service 24/7 dengan pemahaman budaya lokal Riau</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Jangkauan Lengkap</h3>
              <p className="text-gray-600 text-sm">Melayani seluruh kabupaten/kota di Riau dengan rute terlengkap</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Siap Menjelajahi Riau?</h2>
          <p className="text-xl mb-8 text-blue-100">
            Pesan tiket travel atau taksi sekarang dan nikmati perjalanan nyaman ke seluruh destinasi di Riau
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/tickets">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
                <Ticket className="mr-2 h-5 w-5" />
                Pesan Tiket Travel
              </Button>
            </Link>
            <Link href="/taxi">
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white hover:text-blue-600 bg-transparent"
              >
                <Car className="mr-2 h-5 w-5" />
                Pesan Taksi Online
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
