"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Menu,
  Ticket,
  Package,
  User,
  History,
  Settings,
  LogIn,
  UserPlus,
  Home,
  Phone,
  Mail,
  HelpCircle,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"

interface HeaderProps {
  isAuthenticated?: boolean
  userName?: string
}

export function HeaderTaxi({ isAuthenticated = false, userName }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  const closeMobileMenu = () => setIsMobileMenuOpen(false)

  const isActivePage = (path: string) => {
    if (path === "/" && pathname === "/") return true
    if (path !== "/" && pathname.startsWith(path)) return true
    return false
  }

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 flex items-center justify-center">
            <Image
              src="/logo-kopsiku.png"
              alt="Logo Kopsiku"
              width={40}
              height={40}
              className="rounded-full"
            />
            </div>
            <span className="text-xl font-bold text-gray-900">Taxi KOPSI Pekanbaru</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="/tickets"
              className={`transition-colors ${
                isActivePage("/tickets") ? "text-blue-600 font-medium" : "text-gray-600 hover:text-blue-600"
              }`}
            >
              Tiket Travel
            </Link>
            <Link
              href="/tours"
              className={`transition-colors ${
                isActivePage("/tours") ? "text-blue-600 font-medium" : "text-gray-600 hover:text-blue-600"
              }`}
            >
              Paket Perjalanan
            </Link>
            {isAuthenticated ? (
              <Link
                href="/profile"
                className={`transition-colors ${
                  isActivePage("/profile") ? "text-blue-600 font-medium" : "text-gray-600 hover:text-blue-600"
                }`}
              >
                Akun Saya
              </Link>
            ) : (
              <>
                <Link href="/auth/signin">
                  <Button variant="outline" size="sm">
                    Masuk
                  </Button>
                </Link>
                <Link href="/auth/signup">
                  <Button size="sm">Daftar</Button>
                </Link>
              </>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="p-2 bg-transparent"
                  aria-label="Buka menu mobile"
                  onClick={() => setIsMobileMenuOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <SheetHeader className="p-6 pb-4">
                    <div className="flex items-center justify-between">
                      <SheetTitle className="flex items-center space-x-2">
                        <div className="w-8 h-8 flex items-center justify-center">
                          <Image
                            src="/logo-kopsiku.png"
                            width={32}
                            height={32}
                            alt="Logo Kopsi Pekanbaru"
                            className="rounded-lg object-contain"
                          />
                        </div>
                        <span className="text-xl font-bold">Taxi KOPSI Pekanbaru</span>
                      </SheetTitle>
                    </div>
                  </SheetHeader>

                  {/* Content */}
                  <div className="flex-1 px-6 pb-6 overflow-y-auto">
                    <div className="space-y-6">
                      {/* User Section */}
                      {isAuthenticated ? (
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                              <User className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{userName || "Pengguna"}</p>
                              <Badge variant="outline" className="text-xs">
                                Member Premium
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Link href="/auth/signin" onClick={closeMobileMenu}>
                            <Button className="w-full justify-start" variant="default">
                              <LogIn className="mr-3 h-4 w-4" />
                              Masuk
                            </Button>
                          </Link>
                          <Link href="/auth/signup" onClick={closeMobileMenu}>
                            <Button className="w-full justify-start bg-transparent" variant="outline">
                              <UserPlus className="mr-3 h-4 w-4" />
                              Daftar
                            </Button>
                          </Link>
                        </div>
                      )}

                      <Separator />

                      {/* Main Navigation */}
                      <nav className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Menu Utama</h3>
                        <div className="space-y-1">
                          <Link href="/" onClick={closeMobileMenu}>
                            <Button
                              variant={isActivePage("/") ? "secondary" : "ghost"}
                              className="w-full justify-start"
                            >
                              <Home className="mr-3 h-4 w-4" />
                              Beranda
                            </Button>
                          </Link>
                          <Link href="/tickets" onClick={closeMobileMenu}>
                            <Button
                              variant={isActivePage("/tickets") ? "secondary" : "ghost"}
                              className="w-full justify-start"
                            >
                              <Ticket className="mr-3 h-4 w-4" />
                              Tiket Travel
                            </Button>
                          </Link>
                          <Link href="/tours" onClick={closeMobileMenu}>
                            <Button
                              variant={isActivePage("/tours") ? "secondary" : "ghost"}
                              className="w-full justify-start"
                            >
                              <Package className="mr-3 h-4 w-4" />
                              Paket Perjalanan
                            </Button>
                          </Link>
                        </div>
                      </nav>

                      {/* Account Section */}
                      {isAuthenticated && (
                        <>
                          <Separator />
                          <nav className="space-y-2">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Akun Saya</h3>
                            <div className="space-y-1">
                              <Link href="/profile" onClick={closeMobileMenu}>
                                <Button
                                  variant={isActivePage("/profile") ? "secondary" : "ghost"}
                                  className="w-full justify-start"
                                >
                                  <User className="mr-3 h-4 w-4" />
                                  Profil
                                </Button>
                              </Link>
                              <Link href="/profile/orders" onClick={closeMobileMenu}>
                                <Button
                                  variant={isActivePage("/profile/orders") ? "secondary" : "ghost"}
                                  className="w-full justify-start"
                                >
                                  <History className="mr-3 h-4 w-4" />
                                  Riwayat Pesanan
                                </Button>
                              </Link>
                              <Link href="/profile/settings" onClick={closeMobileMenu}>
                                <Button variant="ghost" className="w-full justify-start">
                                  <Settings className="mr-3 h-4 w-4" />
                                  Pengaturan
                                </Button>
                              </Link>
                            </div>
                          </nav>
                        </>
                      )}

                      <Separator />

                      {/* Support Section */}
                      <nav className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Bantuan</h3>
                        <div className="space-y-1">
                          <Button variant="ghost" className="w-full justify-start" onClick={closeMobileMenu}>
                            <HelpCircle className="mr-3 h-4 w-4" />
                            Pusat Bantuan
                          </Button>
                          <Button variant="ghost" className="w-full justify-start" onClick={closeMobileMenu}>
                            <Phone className="mr-3 h-4 w-4" />
                            Hubungi Kami
                          </Button>
                        </div>
                      </nav>

                      {/* Contact Info */}
                      <div className="pt-4 border-t">
                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <Phone className="h-4 w-4" />
                            <span>+62 761 123 4567</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4" />
                            <span>info@kopsipekanbaru.id</span>
                          </div>
                        </div>
                      </div>

                      {/* Sign Out */}
                      {isAuthenticated && (
                        <div className="pt-4">
                          <Button variant="outline" className="w-full bg-transparent" onClick={closeMobileMenu}>
                            Keluar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
