"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { MapPin, CalendarIcon, Clock, Users, Star, Filter, Search, ArrowUpDown, Navigation, Fuel } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

interface Ticket {
  id: number
  from: string
  to: string
  price: number
  duration: string
  departure: string
  arrival: string
  seats: number
  rating: number
  company: string
  facilities: string[]
  image: string
  distance: string
  vehicleType: "Bus" | "MPV" | "Minibus"
  landmarks: string[]
  roadCondition: "Baik" | "Sedang" | "Kurang Baik"
  estimatedFuel: string
}

export default function TicketsPage() {
  const [date, setDate] = useState<Date>()
  const [searchFrom, setSearchFrom] = useState("")
  const [searchTo, setSearchTo] = useState("")
  const [sortBy, setSortBy] = useState("price")
  const [priceRange, setPriceRange] = useState([0, 200000])
  const [selectedVehicleType, setSelectedVehicleType] = useState("all")
  const [selectedDuration, setSelectedDuration] = useState("all")

  const tickets: Ticket[] = [
    {
      id: 1,
      from: "Pekanbaru",
      to: "Dumai",
      price: 85000,
      duration: "2.5 jam",
      departure: "07:00",
      arrival: "09:30",
      seats: 15,
      rating: 4.8,
      company: "KOPSI Express",
      facilities: ["AC", "WiFi", "Toilet", "Snack"],
      image: "/pekanbaru-dumai-bus.png",
      distance: "188 km",
      vehicleType: "Bus",
      landmarks: ["Pelabuhan Dumai", "Pantai Rupat", "Terminal Dumai"],
      roadCondition: "Baik",
      estimatedFuel: "18L",
    },
    {
      id: 2,
      from: "Pekanbaru",
      to: "Bangkinang",
      price: 45000,
      duration: "1.5 jam",
      departure: "08:30",
      arrival: "10:00",
      seats: 12,
      rating: 4.9,
      company: "KOPSI Premium",
      facilities: ["AC", "WiFi", "Comfortable Seats"],
      image: "/pekanbaru-bangkinang-bus.png",
      distance: "62 km",
      vehicleType: "MPV",
      landmarks: ["Masjid Agung Bangkinang", "Danau Buatan Bangkinang", "Pasar Bangkinang"],
      roadCondition: "Baik",
      estimatedFuel: "8L",
    },
    {
      id: 3,
      from: "Pekanbaru",
      to: "Tembilahan",
      price: 95000,
      duration: "3 jam",
      departure: "09:00",
      arrival: "12:00",
      seats: 18,
      rating: 4.7,
      company: "KOPSI Luxury",
      facilities: ["AC", "WiFi", "Reclining Seat", "Meal"],
      image: "/pekanbaru-tembilahan-bus.png",
      distance: "156 km",
      vehicleType: "Bus",
      landmarks: ["Sungai Indragiri", "Pasar Tembilahan", "Jembatan Tembilahan"],
      roadCondition: "Baik",
      estimatedFuel: "16L",
    },
    {
      id: 4,
      from: "Pekanbaru",
      to: "Rengat",
      price: 120000,
      duration: "4 jam",
      departure: "06:30",
      arrival: "10:30",
      seats: 10,
      rating: 4.6,
      company: "KOPSI Express",
      facilities: ["AC", "WiFi", "Toilet", "Entertainment"],
      image: "/pekanbaru-rengat-bus.png",
      distance: "198 km",
      vehicleType: "Bus",
      landmarks: ["Museum Sang Nila Utama", "Jembatan Rengat", "Pasar Rengat"],
      roadCondition: "Sedang",
      estimatedFuel: "22L",
    },
    {
      id: 5,
      from: "Pekanbaru",
      to: "Bagan Siapi-api",
      price: 110000,
      duration: "3.5 jam",
      departure: "07:30",
      arrival: "11:00",
      seats: 14,
      rating: 4.8,
      company: "KOPSI Premium",
      facilities: ["AC", "WiFi", "Comfortable Seats", "Snack"],
      image: "/pekanbaru-bagansiapiapi-bus.png",
      distance: "174 km",
      vehicleType: "Bus",
      landmarks: ["Pelabuhan Bagan Siapi-api", "Pantai Bagansiapiapi", "Pasar Ikan"],
      roadCondition: "Baik",
      estimatedFuel: "19L",
    },
    {
      id: 6,
      from: "Pekanbaru",
      to: "Pasir Pengaraian",
      price: 75000,
      duration: "2 jam",
      departure: "10:00",
      arrival: "12:00",
      seats: 16,
      rating: 4.5,
      company: "KOPSI Express",
      facilities: ["AC", "WiFi", "Comfortable Seats"],
      image: "/pekanbaru-pasirpengaraian-bus.png",
      distance: "98 km",
      vehicleType: "Minibus",
      landmarks: ["Danau Napangga", "Hutan Wisata Rokan Hulu", "Pasar Pasir Pengaraian"],
      roadCondition: "Baik",
      estimatedFuel: "12L",
    },
    {
      id: 7,
      from: "Pekanbaru",
      to: "Siak Sri Indrapura",
      price: 55000,
      duration: "1.5 jam",
      departure: "08:00",
      arrival: "09:30",
      seats: 20,
      rating: 4.7,
      company: "KOPSI Premium",
      facilities: ["AC", "WiFi", "Comfortable Seats"],
      image: "/pekanbaru-siak-bus.png",
      distance: "45 km",
      vehicleType: "Bus",
      landmarks: ["Istana Siak", "Masjid Raya Siak", "Museum Istana Siak"],
      roadCondition: "Baik",
      estimatedFuel: "6L",
    },
    {
      id: 8,
      from: "Pekanbaru",
      to: "Perawang",
      price: 35000,
      duration: "1 jam",
      departure: "09:30",
      arrival: "10:30",
      seats: 25,
      rating: 4.4,
      company: "KOPSI Express",
      facilities: ["AC", "WiFi"],
      image: "/pekanbaru-perawang-bus.png",
      distance: "32 km",
      vehicleType: "MPV",
      landmarks: ["Pabrik Kertas", "Sungai Siak", "Terminal Perawang"],
      roadCondition: "Baik",
      estimatedFuel: "4L",
    },
    {
      id: 9,
      from: "Pekanbaru",
      to: "Kuala Kampar",
      price: 65000,
      duration: "2 jam",
      departure: "11:00",
      arrival: "13:00",
      seats: 18,
      rating: 4.6,
      company: "KOPSI Premium",
      facilities: ["AC", "WiFi", "Comfortable Seats"],
      image: "/pekanbaru-kualakampar-bus.png",
      distance: "78 km",
      vehicleType: "Bus",
      landmarks: ["Sungai Kampar", "Pasar Kuala Kampar", "Jembatan Kampar"],
      roadCondition: "Baik",
      estimatedFuel: "9L",
    },
    {
      id: 10,
      from: "Pekanbaru",
      to: "Pangkalan Kerinci",
      price: 90000,
      duration: "2.5 jam",
      departure: "07:45",
      arrival: "10:15",
      seats: 12,
      rating: 4.5,
      company: "KOPSI Express",
      facilities: ["AC", "WiFi", "Toilet"],
      image: "/pekanbaru-pangkalankerinci-bus.png",
      distance: "125 km",
      vehicleType: "Bus",
      landmarks: ["Pasar Pangkalan Kerinci", "Sungai Kampar Kiri", "Terminal Pangkalan Kerinci"],
      roadCondition: "Sedang",
      estimatedFuel: "14L",
    },
  ]

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesFrom = searchFrom === "" || ticket.from.toLowerCase().includes(searchFrom.toLowerCase())
      const matchesTo = searchTo === "" || ticket.to.toLowerCase().includes(searchTo.toLowerCase())
      const matchesPrice = ticket.price >= priceRange[0] && ticket.price <= priceRange[1]
      const matchesVehicle = selectedVehicleType === "all" || ticket.vehicleType === selectedVehicleType
      const matchesDuration =
        selectedDuration === "all" ||
        (selectedDuration === "short" && Number.parseFloat(ticket.duration) <= 2) ||
        (selectedDuration === "medium" &&
          Number.parseFloat(ticket.duration) > 2 &&
          Number.parseFloat(ticket.duration) <= 3) ||
        (selectedDuration === "long" && Number.parseFloat(ticket.duration) > 3)

      return matchesFrom && matchesTo && matchesPrice && matchesVehicle && matchesDuration
    })
  }, [searchFrom, searchTo, priceRange, selectedVehicleType, selectedDuration])

  const sortedTickets = [...filteredTickets].sort((a, b) => {
    switch (sortBy) {
      case "price":
        return a.price - b.price
      case "duration":
        return Number.parseFloat(a.duration) - Number.parseFloat(b.duration)
      case "rating":
        return b.rating - a.rating
      case "departure":
        return a.departure.localeCompare(b.departure)
      case "distance":
        return Number.parseInt(a.distance) - Number.parseInt(b.distance)
      default:
        return 0
    }
  })

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price)
  }

  const getRoadConditionColor = (condition: string) => {
    switch (condition) {
      case "Baik":
        return "bg-green-100 text-green-800"
      case "Sedang":
        return "bg-yellow-100 text-yellow-800"
      case "Kurang Baik":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getVehicleTypeColor = (type: string) => {
    switch (type) {
      case "Bus":
        return "bg-blue-100 text-blue-800"
      case "MPV":
        return "bg-purple-100 text-purple-800"
      case "Minibus":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Tiket Travel Riau</h1>
          <p className="text-gray-600">Temukan tiket travel terbaik ke seluruh destinasi di Provinsi Riau</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Filter */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Filter className="mr-2 h-5 w-5" />
                  Filter & Pencarian
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Search */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="from">Dari</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="from"
                        placeholder="Kota asal"
                        value={searchFrom}
                        onChange={(e) => setSearchFrom(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="to">Ke</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="to"
                        placeholder="Kota tujuan"
                        value={searchTo}
                        onChange={(e) => setSearchTo(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Date Picker */}
                <div>
                  <Label>Tanggal Keberangkatan</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP", { locale: id }) : "Pilih tanggal"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>

                <Separator />

                {/* Price Range */}
                <div>
                  <Label>Rentang Harga</Label>
                  <div className="px-2 mt-2">
                    <Slider
                      value={priceRange}
                      onValueChange={setPriceRange}
                      max={200000}
                      min={0}
                      step={5000}
                      className="w-full"
                    />
                    <div className="flex justify-between text-sm text-gray-500 mt-2">
                      <span>{formatPrice(priceRange[0])}</span>
                      <span>{formatPrice(priceRange[1])}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Vehicle Type */}
                <div>
                  <Label>Jenis Kendaraan</Label>
                  <Select value={selectedVehicleType} onValueChange={setSelectedVehicleType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kendaraan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kendaraan</SelectItem>
                      <SelectItem value="Bus">Bus</SelectItem>
                      <SelectItem value="MPV">MPV</SelectItem>
                      <SelectItem value="Minibus">Minibus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Duration Filter */}
                <div>
                  <Label>Durasi Perjalanan</Label>
                  <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih durasi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Durasi</SelectItem>
                      <SelectItem value="short">&lt;= 2 jam</SelectItem>
                      <SelectItem value="medium">2-3 jam</SelectItem>
                      <SelectItem value="long">&gt; 3 jam</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Sort */}
                <div>
                  <Label>Urutkan Berdasarkan</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="price">Harga Terendah</SelectItem>
                      <SelectItem value="duration">Durasi Tercepat</SelectItem>
                      <SelectItem value="distance">Jarak Terdekat</SelectItem>
                      <SelectItem value="rating">Rating Tertinggi</SelectItem>
                      <SelectItem value="departure">Keberangkatan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tickets List */}
          <div className="lg:col-span-3">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-gray-600">
                Menampilkan {sortedTickets.length} dari {tickets.length} rute
              </p>
              <Button variant="outline" size="sm">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Urutkan
              </Button>
            </div>

            <div className="space-y-6">
              {sortedTickets.map((ticket) => (
                <Card key={ticket.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="md:flex">
                    <div className="md:w-1/3 relative h-48 md:h-auto">
                      <Image
                        src={ticket.image || "/placeholder.svg"}
                        alt={`${ticket.from} to ${ticket.to}`}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute top-4 left-4 flex flex-col gap-2">
                        <Badge className="bg-white text-gray-900">
                          <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                          {ticket.rating}
                        </Badge>
                        <Badge className={getRoadConditionColor(ticket.roadCondition)}>
                          <Navigation className="h-3 w-3 mr-1" />
                          {ticket.roadCondition}
                        </Badge>
                      </div>
                      <div className="absolute bottom-4 left-4">
                        <Badge variant="secondary" className="bg-blue-600 text-white">
                          {ticket.distance}
                        </Badge>
                      </div>
                    </div>
                    <div className="md:w-2/3 p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold mb-1">
                            {ticket.from} → {ticket.to}
                          </h3>
                          <p className="text-gray-600 text-sm">{ticket.company}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={getVehicleTypeColor(ticket.vehicleType)}>{ticket.vehicleType}</Badge>
                            <Badge variant="outline" className="text-xs">
                              <Fuel className="h-3 w-3 mr-1" />~{ticket.estimatedFuel}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">{formatPrice(ticket.price)}</p>
                          <p className="text-sm text-gray-600">per orang</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="h-4 w-4 mr-2" />
                          <div>
                            <p className="font-medium">
                              {ticket.departure} - {ticket.arrival}
                            </p>
                            <p>{ticket.duration}</p>
                          </div>
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Users className="h-4 w-4 mr-2" />
                          <p>{ticket.seats} kursi tersedia</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {ticket.facilities.slice(0, 3).map((facility) => (
                            <Badge key={facility} variant="secondary" className="text-xs">
                              {facility}
                            </Badge>
                          ))}
                          {ticket.facilities.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{ticket.facilities.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Landmarks */}
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Landmark Perjalanan:</p>
                        <div className="flex flex-wrap gap-1">
                          {ticket.landmarks.slice(0, 3).map((landmark, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              <MapPin className="h-3 w-3 mr-1" />
                              {landmark}
                            </Badge>
                          ))}
                          {ticket.landmarks.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{ticket.landmarks.length - 3} lainnya
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <Link href={`/details/${ticket.id}`}>
                          <Button variant="outline">Lihat Detail</Button>
                        </Link>
                        <Link href={`/details/${ticket.id}`}>
                          <Button>Pesan Sekarang</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {sortedTickets.length === 0 && (
              <Card className="p-12 text-center">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Tidak ada tiket ditemukan</h3>
                <p className="text-gray-600">Coba ubah kriteria pencarian atau filter Anda</p>
                <Button
                  variant="outline"
                  className="mt-4 bg-transparent"
                  onClick={() => {
                    setSearchFrom("")
                    setSearchTo("")
                    setPriceRange([0, 200000])
                    setSelectedVehicleType("all")
                    setSelectedDuration("all")
                  }}
                >
                  Reset Filter
                </Button>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
