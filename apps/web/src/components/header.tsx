"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, User, Phone } from "lucide-react"
import { MobileNav } from "@/components/mobile-nav"

export function Header() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center mx-auto">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Image
              src="/logo-kopsiku.png"
              alt="Logo Kopsiku"
              width={40}
              height={40}
              className="rounded-full"
            />
            <span className="hidden font-bold sm:inline-block">KOPSI Pekanbaru</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link href="/tickets" className="transition-colors hover:text-foreground/80 text-foreground/60">
              Tiket Travel
            </Link>
            <Link href="/tours" className="transition-colors hover:text-foreground/80 text-foreground/60">
              Paket Wisata
            </Link>
            <Link href="/taxi" className="transition-colors hover:text-foreground/80 text-foreground/60">
              Taksi Online
            </Link>
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
            <Link href="/" className="flex items-center space-x-2 md:hidden">
              <Image
                src="/logo-kopsiku.png"
                alt="KOPSI Pekanbaru"
                width={100}
                height={100}
                // className="rounded-full"
              />
              <span className="font-bold">Pekanbaru</span>
            </Link>
          </div>
          <nav className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/profile">
                <User className="h-4 w-4" />
                <span className="sr-only">Profile</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="tel:+6276112345678">
                <Phone className="h-4 w-4" />
                <span className="sr-only">Call</span>
              </Link>
            </Button>
          </nav>
        </div>
      </div>
    </header>
  )
}
