import Link from "next/link"
import Image from "next/image"
import { Car, Ticket, Package, User, Phone, Home, LogIn } from "lucide-react"
import { LogoutButton } from "./auth/logout-button"
import { useAuth } from "@/lib/use-auth"
import { Button } from "@/components/ui/button"

export function MobileNav() {
  const { isAuthenticated, isLoading } = useAuth()

  return (
    <div className="flex flex-col space-y-3 mt-3 ms-3">
      <Link href="/" className="flex items-center space-x-2 mb-4">
        <Image
          src="/logo-kopsiku.png"
          alt="KOPSI Pekanbaru"
          width={32}
          height={32}
          className="rounded-full"
        />
        <span className="font-bold">KOPSI Pekanbaru</span>
      </Link>

      <Link
        href="/"
        className="flex items-center space-x-3 text-lg font-medium transition-colors hover:text-foreground/80"
      >
        <Home className="h-5 w-5 me-3" />
        Beranda
      </Link>

      <Link
        href="/tickets"
        className="flex items-center space-x-3 text-lg font-medium transition-colors hover:text-foreground/80"
      >
        <Ticket className="h-5 w-5 me-3" />
        Tiket Travel
      </Link>

      <Link
        href="/tours"
        className="flex items-center space-x-3 text-lg font-medium transition-colors hover:text-foreground/80"
      >
        <Package className="h-5 w-5 me-3" />
        Paket Wisata
      </Link>

      <Link
        href="/taxi"
        className="flex items-center space-x-3 text-lg font-medium transition-colors hover:text-foreground/80"
      >
        <Car className="h-5 w-5 me-3" />
        Taksi Online
      </Link>

      <div className="border-t pt-4 mt-4 pe-4">
        {isAuthenticated && (
          <Link
            href="/profile"
            className="flex items-center space-x-3 text-lg font-medium transition-colors hover:text-foreground/80"
          >
            <User className="h-5 w-5 me-3" />
            Profile
          </Link>
        )}

        <Link
          href="tel:+6276112345678"
          className="flex items-center space-x-3 text-lg font-medium transition-colors hover:text-foreground/80 my-3"
        >
          <Phone className="h-5 w-5 me-3" />
          Hubungi Kami
        </Link>

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