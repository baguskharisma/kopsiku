"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, User, Phone, LogIn, Coins, Eye } from "lucide-react"
import { MobileNav } from "@/components/mobile-nav"
import { LogoutButton } from "./auth/logout-button"
import { useAuth } from "@/lib/use-auth"
import { useCoins } from "@/hooks/use-coins"

export function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const { isAuthenticated, isLoading, user } = useAuth()
  const { data: coins, isLoading: coinsLoading, isError } = useCoins()
  
  // Cek apakah user adalah Observer
  const isObserver = user?.role === "OBSERVER"

  // Menu items berdasarkan role
  const getMenuItems = () => {
    // Observer hanya bisa akses halaman orders
    if (isObserver) {
      return [
        {
          href: "/orders",
          label: "Monitor Pesanan",
          icon: <Eye className="h-4 w-4 mr-1" />
        }
      ]
    }

    // Menu default untuk role lain
    return [
      {
        href: "/tickets",
        label: "Tiket Travel",
      },
      {
        href: "/tours",
        label: "Paket Wisata",
      },
      {
        href: "/taxi",
        label: "Taksi Online",
      },
      {
        href: "/orders",
        label: "Riwayat",
      }
    ]
  }

  const menuItems = getMenuItems()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center mx-auto">
        <div className="mr-4 hidden md:flex">
          <Link href={isObserver ? "/orders" : "/"} className="mr-6 flex items-center space-x-2">
            <Image
              src="/logo-kopsiku.png"
              alt="Logo Kopsiku"
              width={40}
              height={40}
              className="rounded-full"
            />
            <span className="hidden font-bold sm:inline-block">
              {isObserver ? "KOPSI Monitor" : "KOPSI Pekanbaru"}
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {menuItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href} 
                className="transition-colors hover:text-foreground/80 text-foreground/60 flex items-center"
              >
                {"icon" in item && item.icon}
                {item.label}
                {isObserver && item.href === "/orders" && (
                  <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">Observer</span>
                )}
              </Link>
            ))}
          </nav>
        </div>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="pr-0">
            <MobileNav />
          </SheetContent>
        </Sheet>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <Link href={isObserver ? "/orders" : "/"} className="flex items-center space-x-2 md:hidden">
              <Image
                src="/logo-kopsiku.png"
                alt="KOPSI Pekanbaru"
                width={100}
                height={100}
              />
              <span className="font-bold">
                {isObserver ? "Monitor" : "Pekanbaru"}
              </span>
            </Link>
          </div>
          <nav className="flex items-center space-x-2">
          {isAuthenticated && !isObserver && (
          <div className="hidden md:flex items-center space-x-3">
            {coinsLoading ? (
              <div className="px-2 py-1 rounded-full text-sm">—</div>
            ) : isError ? (
              <div className="px-2 py-1 rounded-full text-sm text-red-600">err</div>
            ) : (
              <div className="flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                <Coins className="h-4 w-4 mr-1" />
                {(typeof coins === "number" ? coins.toLocaleString("id-ID") : "0")} coin
              </div>
            )}
          </div>
          )}
          
            {isAuthenticated && !isObserver && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/profile">
                  <User className="h-4 w-4" />
                  <span className="sr-only">Profile</span>
                </Link>
              </Button>
            )}
            
            {!isObserver && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="tel:+6276112345678">
                  <Phone className="h-4 w-4" />
                  <span className="sr-only">Call</span>
                </Link>
              </Button>
            )}
            
            {!isLoading && (
              <span className="hidden md:inline-block">
                {isAuthenticated ? (
                  <LogoutButton />
                ) : (
                  <Button size="sm" asChild>
                    <Link href="/login">
                      Masuk
                    </Link>
                  </Button>
                )}
              </span>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}