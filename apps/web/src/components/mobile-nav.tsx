import Link from "next/link"
import Image from "next/image"
import { Car, Ticket, Package, User, Phone, Home, Coins, History, Eye, AlertCircle } from "lucide-react"
import { LogoutButton } from "./auth/logout-button"
import { useAuth } from "@/lib/use-auth"
import { Button } from "@/components/ui/button"
import { useCoins } from "@/hooks/use-coins"
import { Badge } from "@/components/ui/badge"

export function MobileNav() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const { data: coins, isLoading: coinsLoading, isError } = useCoins()
  
  // Cek apakah user adalah Observer
  const isObserver = user?.role === "OBSERVER"

  // Nav items berdasarkan role
  const getNavItems = () => {
    // Observer hanya bisa melihat dan mengakses halaman orders
    if (isObserver) {
      return [
        {
          href: "/orders",
          label: "Monitor Pesanan",
          icon: <Eye className="h-5 w-5 me-3" />,
          badge: "Observer"
        }
      ]
    }

    // Menu default untuk role lain
    return [
      {
        href: "/",
        label: "Beranda",
        icon: <Home className="h-5 w-5 me-3" />
      },
      {
        href: "/tickets",
        label: "Tiket Travel",
        icon: <Ticket className="h-5 w-5 me-3" />
      },
      {
        href: "/tours",
        label: "Paket Wisata",
        icon: <Package className="h-5 w-5 me-3" />
      },
      {
        href: "/taxi",
        label: "Taksi Online",
        icon: <Car className="h-5 w-5 me-3" />
      },
      {
        href: "/orders",
        label: "Riwayat",
        icon: <History className="h-5 w-5 me-3" />
      }
    ]
  }

  const navItems = getNavItems()

  return (
    <div className="flex flex-col space-y-3 mt-3 ms-3">
      <Link href={isObserver ? "/orders" : "/"} className="flex items-center space-x-2 mb-4">
        <Image
          src="/logo-kopsiku.png"
          alt="KOPSI Pekanbaru"
          width={32}
          height={32}
          className="rounded-full"
        />
        <span className="font-bold">
          {isObserver ? "KOPSI Monitor" : "KOPSI Pekanbaru"}
        </span>
      </Link>

      {isAuthenticated && !isObserver && (
        <div className="mb-4">
          {coinsLoading ? (
            <div className="text-sm">Memuat koin…</div>
          ) : isError ? (
            <div className="text-sm text-red-600">Gagal ambil koin</div>
          ) : (
            <div className="flex items-center space-x-2 text-green-500 font-semibold">
              <Coins className="h-5 w-5" />
              <span>{typeof coins === "number" ? coins.toLocaleString("id-ID") : "0"} coins</span>
            </div>
          )}
        </div>
      )}
      
      {/* Observer Mode Badge */}
      {isAuthenticated && isObserver && (
        <div className="mb-4">
          <div className="flex items-center space-x-2 bg-blue-100 text-blue-800 rounded-md px-3 py-2 font-medium">
            <AlertCircle className="h-5 w-5" />
            <span>Mode Observer Aktif</span>
          </div>
        </div>
      )}

      {/* Main Navigation */}
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center space-x-3 text-lg font-medium transition-colors hover:text-foreground/80"
        >
          {item.icon}
          <span>{item.label}</span>
          {"badge" in item && item.badge && (
            <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-800 border-blue-300">
              {item.badge}
            </Badge>
          )}
        </Link>
      ))}

      <div className="border-t pt-4 mt-4 pe-4">
        {isAuthenticated && !isObserver && (
          <Link
            href="/profile"
            className="flex items-center space-x-3 text-lg font-medium transition-colors hover:text-foreground/80"
          >
            <User className="h-5 w-5 me-3" />
            Profile
          </Link>
        )}

        {!isObserver && (
          <Link
            href="tel:+6276112345678"
            className="flex items-center space-x-3 text-lg font-medium transition-colors hover:text-foreground/80 my-3"
          >
            <Phone className="h-5 w-5 me-3" />
            Hubungi Kami
          </Link>
        )}

        {!isLoading && (
          <>
            {isAuthenticated ? (
              <LogoutButton />
            ) : (
              <Button className="w-full" asChild>
                <Link href="/login">
                  Masuk
                </Link>
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}