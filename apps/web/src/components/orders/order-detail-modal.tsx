// File: components/orders/order-detail-modal.tsx
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { OrderStatus } from "@prisma/client";
import { formatRupiah } from "@/lib/utils";
import { MapPin, User, Car, CreditCard, Clock, Info, Receipt, CircleDollarSign } from "lucide-react";

// Status badge color mapping
const statusColorMap: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-500",
  DRIVER_ASSIGNED: "bg-blue-500",
  DRIVER_ACCEPTED: "bg-blue-700",
  DRIVER_ARRIVING: "bg-purple-500",
  IN_PROGRESS: "bg-purple-700",
  COMPLETED: "bg-green-600",
  CANCELLED_BY_CUSTOMER: "bg-red-500",
  CANCELLED_BY_DRIVER: "bg-red-600",
  CANCELLED_BY_SYSTEM: "bg-red-700",
  EXPIRED: "bg-gray-500",
  NO_DRIVER_AVAILABLE: "bg-gray-600",
};

// Helper to format status for display
const formatStatus = (status: OrderStatus): string => {
  switch (status) {
    case "PENDING":
      return "Menunggu Driver";
    case "DRIVER_ASSIGNED":
      return "Driver Ditugaskan";
    case "DRIVER_ACCEPTED":
      return "Driver Menerima";
    case "DRIVER_ARRIVING":
      return "Driver Menuju";
    case "IN_PROGRESS":
      return "Dalam Perjalanan";
    case "COMPLETED":
      return "Selesai";
    case "CANCELLED_BY_CUSTOMER":
      return "Dibatalkan Penumpang";
    case "CANCELLED_BY_DRIVER":
      return "Dibatalkan Driver";
    case "CANCELLED_BY_SYSTEM":
      return "Dibatalkan Sistem";
    case "EXPIRED":
      return "Kedaluwarsa";
    case "NO_DRIVER_AVAILABLE":
      return "Tidak Ada Driver";
    default:
      return status;
  }
};

const extractPreferredDriver = (specialRequests: string | null | undefined) => {
  if (!specialRequests || !specialRequests.includes("Preferred driver:")) {
    return null;
  }
  
  try {
    // Contoh format: Preferred driver: Jhon Kuntan (BM 1399 JU)
    const driverText = specialRequests.split("Preferred driver:")[1].trim();
    const driverName = driverText.split("(")[0].trim();
    const plateNumber = driverText.match(/\(([^)]+)\)/)?.[1] || "";
    
    return {
      name: driverName,
      plateNumber: plateNumber
    };
  } catch (error) {
    console.error("Error extracting preferred driver:", error);
    return null;
  }
};

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any; // Lebih baik gunakan type Order yang sudah didefinisikan
  isObserver?: boolean; // Tambahkan prop untuk mode Observer
}

export function OrderDetailModal({ isOpen, onClose, order, isObserver = false }: OrderDetailModalProps) {
  const [activeTab, setActiveTab] = useState("details");

  const calculateDriverNetEarnings = (): string => {
    try {
      const totalFare = parseInt(order.totalFare) / 100;
      const operationalFeeRupiah = order.operationalFeeCoins ? parseInt(order.operationalFeeCoins) : 0;
      const driverNetEarnings = totalFare - operationalFeeRupiah;
      
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Math.round(Math.max(0, driverNetEarnings)));
    } catch (error) {
      return "Rp 0";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detail Pesanan {order.orderNumber}</span>
            <Badge
              className={`${statusColorMap?.[order.status as keyof typeof statusColorMap] ?? ''} text-white`}
            >
              {formatStatus(order.status)}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Tanggal: {format(new Date(order.createdAt), "dd MMMM yyyy, HH:mm", { locale: id })}
            
            {/* Observer Badge */}
            {isObserver && (
              <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-800 border-blue-300">
                Observer Mode
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Detail Pesanan</TabsTrigger>
            <TabsTrigger value="payment">Pembayaran</TabsTrigger>
            <TabsTrigger value="driver">Informasi Driver</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start">
                  <MapPin className="h-5 w-5 text-muted-foreground mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Lokasi Jemput</p>
                    <p className="font-medium">{order.pickupAddress}</p>
                    {order.pickupLat && order.pickupLng && (
                      <p className="text-xs text-muted-foreground">
                        {order.pickupLat.toFixed(6)}, {order.pickupLng.toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start">
                  <MapPin className="h-5 w-5 text-muted-foreground mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Lokasi Tujuan</p>
                    <p className="font-medium">{order.dropoffAddress}</p>
                    {order.dropoffLat && order.dropoffLng && (
                      <p className="text-xs text-muted-foreground">
                        {order.dropoffLat.toFixed(6)}, {order.dropoffLng.toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start">
                  <User className="h-5 w-5 text-muted-foreground mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Penumpang</p>
                    <p className="font-medium">{order.passengerName}</p>
                    <p className="text-sm">{order.passengerPhone}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start">
                  <Car className="h-5 w-5 text-muted-foreground mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Tipe Kendaraan</p>
                    <p className="font-medium">
                      {order.requestedVehicleType === "ECONOMY"
                        ? "Ekonomi"
                        : order.requestedVehicleType === "PREMIUM"
                        ? "Premium"
                        : order.requestedVehicleType === "LUXURY"
                        ? "Luxury"
                        : order.requestedVehicleType === "MOTORCYCLE"
                        ? "Motor"
                        : order.requestedVehicleType}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Clock className="h-5 w-5 text-muted-foreground mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Estimasi Perjalanan</p>
                    <p className="font-medium">
                      {(order.distanceMeters / 1000).toFixed(1)} km • {order.estimatedDurationMinutes} menit
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Info className="h-5 w-5 text-muted-foreground mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Permintaan Khusus</p>
                    <p className="font-medium">
                      {order.specialRequests || "Tidak ada permintaan khusus"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Timeline (contoh saja) */}
            {order.statusHistory && order.statusHistory.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-2">Riwayat Status</h3>
                <div className="space-y-2">
                  {order.statusHistory.map((history: any, index: number) => (
                    <div key={index} className="flex items-center">
                      <div className="flex flex-col items-center mr-2">
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                        {index < order.statusHistory.length - 1 && (
                          <div className="h-10 w-0.5 bg-primary/30" />
                        )}
                      </div>
                      <div className="mb-2">
                        <p className="font-medium">
                          {formatStatus(history.toStatus)}
                        </p>
                        {history.reason && (
                          <p className="text-sm">{history.reason}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="payment" className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="flex items-start">
                <CreditCard className="h-5 w-5 text-muted-foreground mr-2 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Metode Pembayaran</p>
                  <p className="font-medium">
                    {order.paymentMethod === "CASH"
                      ? "Tunai"
                      : order.paymentMethod === "TRANSFER"
                      ? "Transfer Bank"
                      : order.paymentMethod === "EMONEY"
                      ? "E-Money"
                      : order.paymentMethod || "Tunai"}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium mb-2">Rincian Biaya</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Biaya Dasar</span>
                    <span>{formatRupiah(parseInt(order.baseFare) / 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Biaya Jarak</span>
                    <span>{formatRupiah(parseInt(order.distanceFare) / 100)}</span>
                  </div>
                  {order.airportFare && parseInt(order.airportFare) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Biaya Bandara</span>
                      <span>{formatRupiah(parseInt(order.airportFare) / 100)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>Total</span>
                    <span>{formatRupiah(parseInt(order.totalFare) / 100)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Biaya Layanan (Operational Fee) */}
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center">
                  <Receipt className="h-4 w-4 mr-1" />
                  Biaya Layanan
                </h3>
                <div className="bg-slate-50 p-3 rounded-md">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Status</span>
                    <Badge
                      className={`${
                        order.operationalFeeStatus === "CHARGED"
                          ? "bg-green-600"
                          : order.operationalFeeStatus === "PENDING"
                          ? "bg-yellow-500"
                          : order.operationalFeeStatus === "FAILED"
                          ? "bg-red-500"
                          : "bg-gray-500"
                      } text-white`}
                    >
                      {order.operationalFeeStatus === "CHARGED"
                        ? "Terbayar"
                        : order.operationalFeeStatus === "PENDING"
                        ? "Menunggu"
                        : order.operationalFeeStatus === "FAILED"
                        ? "Gagal"
                        : order.operationalFeeStatus || "Tidak Berlaku"}
                    </Badge>
                  </div>
                  {order.operationalFeeCoins && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Jumlah</span>
                      <span>{order.operationalFeeCoins} coins</span>
                    </div>
                  )}
                  {order.operationalFeePercent && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Persentase</span>
                      <span>{(order.operationalFeePercent * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  {order.balanceBeforeOperationalFee && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Saldo Sebelum</span>
                      <span>{order.balanceBeforeOperationalFee} coins</span>
                    </div>
                  )}
                  {order.balanceAfterOperationalFee && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Saldo Setelah</span>
                      <span>{order.balanceAfterOperationalFee} coins</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Driver Net Earnings */}
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center">
                  <CircleDollarSign className="h-4 w-4 mr-1" />
                  Pendapatan Driver (Netto)
                </h3>
                <div className="bg-green-50 p-3 rounded-md">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Pendapatan</span>
                    <span className="font-medium text-green-700">{calculateDriverNetEarnings()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    *Pendapatan bersih setelah dipotong biaya layanan
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="driver" className="space-y-4 pt-4">
            {order.driver ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center">
                    {order.driver.avatarUrl ? (
                      <img
                        src={order.driver.avatarUrl}
                        alt={order.driver.name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-6 w-6 text-slate-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{order.driver.name}</p>
                    <p className="text-sm text-muted-foreground">{order.driver.phone}</p>
                    {order.driver.email && (
                      <p className="text-sm text-muted-foreground">{order.driver.email}</p>
                    )}
                  </div>
                </div>

                {order.driver.driverProfile && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        Rating: {order.driver.driverProfile.rating || "N/A"}
                      </Badge>
                      <Badge variant="outline">
                        Status: {order.driver.driverProfile.driverStatus || "N/A"}
                      </Badge>
                    </div>

                    {/* Observer-specific info */}
                    {isObserver && (
                      <div className="bg-blue-50 p-3 rounded-md space-y-2">
                        <h4 className="text-sm font-medium text-blue-800">Informasi Observer</h4>
                        <div className="flex justify-between">
                          <span className="text-sm text-blue-700">ID Driver</span>
                          <span className="text-sm font-medium">{order.driver.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-blue-700">Lokasi Terakhir</span>
                          <span className="text-sm font-medium">
                            {order.driver.driverProfile.currentLat && order.driver.driverProfile.currentLng
                              ? `${order.driver.driverProfile.currentLat.toFixed(6)}, ${order.driver.driverProfile.currentLng.toFixed(6)}`
                              : "Tidak tersedia"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-blue-700">Total Perjalanan</span>
                          <span className="text-sm font-medium">
                            {order.driver.driverProfile.totalTrips || "0"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-blue-700">Perjalanan Selesai</span>
                          <span className="text-sm font-medium">
                            {order.driver.driverProfile.completedTrips || "0"}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {order.fleet && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Kendaraan</h3>
                    <div className="bg-slate-50 p-3 rounded-md space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Plat Nomor</span>
                        <span className="font-medium">{order.fleet.plateNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Kendaraan</span>
                        <span>
                          {order.fleet.brand} {order.fleet.model} ({order.fleet.color})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Tipe</span>
                        <span>{order.fleet.vehicleType}</span>
                      </div>
                      
                      {/* Observer-specific info */}
                      {isObserver && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">ID Kendaraan</span>
                            <span className="text-sm">{order.fleet.id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Status</span>
                            <span className="text-sm">{order.fleet.status || "ACTIVE"}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Tampilkan info driver preferensi jika ada */}
                {extractPreferredDriver(order.specialRequests) ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center">
                        <User className="h-6 w-6 text-slate-500" />
                      </div>
                      <div>
                        <p className="font-medium">{extractPreferredDriver(order.specialRequests)?.name}</p>
                        <p className="text-sm text-blue-600 font-medium">Driver Preferensi</p>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium mb-2">Kendaraan</h3>
                      <div className="bg-slate-50 p-3 rounded-md">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Plat Nomor</span>
                          <span className="font-medium">{extractPreferredDriver(order.specialRequests)?.plateNumber}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          <p>Informasi kendaraan ini berdasarkan preferensi penumpang.</p>
                          <p>Status: Tidak ditugaskan secara resmi.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Car className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground font-medium">
                      Belum ada driver yang ditugaskan
                    </p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}