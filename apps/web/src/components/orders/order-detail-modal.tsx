"use client";

import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Navigation, AlertCircle, Check, Coins, Clock } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { OrderStatus } from "@prisma/client";

// Types
interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  passengerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  createdAt: string;
  totalFare: string;
  baseFare: string;
  distanceFare: string;
  airportFare?: string;
  requestedVehicleType: string;
  distanceMeters: number;
  estimatedDurationMinutes: number;
  operationalFeeCoins?: string;
  operationalFeePercent?: number;
  operationalFeeStatus?: string;
  operationalFeeConfig?: any;
  driver?: {
    id: string;
    name: string;
    phone: string;
  };
  tripStartedAt?: string;
  tripCompletedAt?: string;
  driverAssignedAt?: string;
  driverAcceptedAt?: string;
  driverArrivedAt?: string;
  cancelledAt?: string;
  cancelledReason?: string;
  paymentMethod?: string;
}

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

// Helper to format operational fee status
const formatOperationalFeeStatus = (status?: string): string => {
  switch (status) {
    case "CHARGED":
      return "Terbayar";
    case "PENDING":
      return "Menunggu";
    case "FAILED":
      return "Gagal";
    case "NOT_APPLICABLE":
      return "Tidak Berlaku";
    default:
      return status || "Tidak Ada";
  }
};

// Helper to get operational fee status badge color
const getOperationalFeeStatusColor = (status?: string): string => {
  switch (status) {
    case "CHARGED":
      return "bg-green-600";
    case "PENDING":
      return "bg-yellow-500";
    case "FAILED":
      return "bg-red-500";
    case "NOT_APPLICABLE":
      return "bg-gray-500";
    default:
      return "bg-gray-400";
  }
};

// Payment method format
const formatPaymentMethod = (method?: string): string => {
  switch (method) {
    case "CASH":
      return "Tunai";
    case "BANK_TRANSFER":
      return "Transfer Bank";
    case "QRIS":
      return "QRIS";
    case "EWALLET":
      return "E-Wallet";
    case "CREDIT_CARD":
      return "Kartu Kredit";
    case "DEBIT_CARD":
      return "Kartu Debit";
    case "COINS":
      return "Koin";
    default:
      return method || "Tidak Diketahui";
  }
};

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
}

export function OrderDetailModal({ isOpen, onClose, order }: OrderDetailModalProps) {
  // Format timestamp to readable date/time
  const formatDateTime = (timestamp?: string) => {
    if (!timestamp) return "-";
    return format(new Date(timestamp), "dd MMM yyyy HH:mm", {
      locale: id,
    });
  };

  // Format vehicle type
  const formatVehicleType = (type: string): string => {
    switch (type) {
      case "ECONOMY":
        return "Ekonomi";
      case "PREMIUM":
        return "Premium";
      case "LUXURY":
        return "Luxury";
      case "MOTORCYCLE":
        return "Motor";
      default:
        return type;
    }
  };

  // Format fee rule from operational fee config
  const getFeeRule = (): string => {
    if (order.operationalFeeConfig?.feeRule) {
      return order.operationalFeeConfig.feeRule;
    }
    
    if (order.distanceMeters >= 1000 && order.distanceMeters <= 6000) {
      return "7.5% (1-6km)";
    } else if (order.distanceMeters > 6000) {
      return "11% (>6km)";
    } else {
      return "5% (<1km)";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detail Pesanan #{order.orderNumber}</span>
            <Badge
              className={`${
                statusColorMap[order.status as OrderStatus]
              } text-white ml-2`}
            >
              {formatStatus(order.status as OrderStatus)}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {formatDateTime(order.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left column */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Informasi Perjalanan</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-start">
                  <MapPin className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm text-muted-foreground">Lokasi Jemput</div>
                    <div>{order.pickupAddress}</div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-start">
                  <Navigation className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm text-muted-foreground">Lokasi Tujuan</div>
                    <div>{order.dropoffAddress}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Jarak</div>
                  <div>{(order.distanceMeters / 1000).toFixed(1)} km</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Estimasi Waktu</div>
                  <div>{order.estimatedDurationMinutes} menit</div>
                </div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground">Tipe Kendaraan</div>
                <div>{formatVehicleType(order.requestedVehicleType)}</div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground">Penumpang</div>
                <div>{order.passengerName}</div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground">Metode Pembayaran</div>
                <div>{formatPaymentMethod(order.paymentMethod)}</div>
              </div>
            </div>

            {order.driver && (
              <>
                <h3 className="text-lg font-semibold mt-6 mb-2">Informasi Driver</h3>
                <div className="space-y-2">
                  <div>
                    <div className="text-sm text-muted-foreground">Nama Driver</div>
                    <div>{order.driver.name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Telepon Driver</div>
                    <div>{order.driver.phone}</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right column */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Rincian Biaya</h3>
            
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>Tarif Dasar</TableCell>
                  <TableCell className="text-right">
                    {formatRupiah(parseInt(order.baseFare) / 100)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Tarif Jarak</TableCell>
                  <TableCell className="text-right">
                    {formatRupiah(parseInt(order.distanceFare) / 100)}
                  </TableCell>
                </TableRow>
                {order.airportFare && parseInt(order.airportFare) > 0 && (
                  <TableRow>
                    <TableCell>Tarif Bandara</TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(parseInt(order.airportFare) / 100)}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="font-medium">
                  <TableCell>Total Tarif</TableCell>
                  <TableCell className="text-right">
                    {formatRupiah(parseInt(order.totalFare) / 100)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <h3 className="text-lg font-semibold mt-6 mb-2">Biaya Operasional</h3>
            
            <div className="rounded-md border p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <Coins className="h-5 w-5 mr-2 text-blue-600" />
                  <span>Status Pembayaran</span>
                </div>
                <Badge
                  className={`${getOperationalFeeStatusColor(order.operationalFeeStatus)} text-white`}
                >
                  {formatOperationalFeeStatus(order.operationalFeeStatus)}
                </Badge>
              </div>
              
              {order.operationalFeeCoins && parseInt(order.operationalFeeCoins) > 0 ? (
                <>
                  <Separator />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Jumlah Coin</div>
                      <div className="font-medium">
                        {new Intl.NumberFormat("id-ID").format(parseInt(order.operationalFeeCoins))} coins
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Persentase</div>
                      <div className="font-medium">
                        {order.operationalFeePercent
                          ? `${(order.operationalFeePercent * 100).toFixed(1)}%`
                          : "-"}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Perhitungan Biaya</div>
                    <div className="text-sm">
                      Berdasarkan {getFeeRule()} untuk jarak {(order.distanceMeters / 1000).toFixed(1)} km
                    </div>
                  </div>
                  
                  {order.operationalFeeStatus === "FAILED" && (
                    <div className="bg-red-50 p-2 rounded-md flex items-start">
                      <AlertCircle className="h-4 w-4 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-red-600">
                        Gagal memproses biaya operasional. Silakan hubungi layanan pelanggan.
                      </div>
                    </div>
                  )}
                  
                  {order.operationalFeeStatus === "CHARGED" && (
                    <div className="bg-green-50 p-2 rounded-md flex items-start">
                      <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-green-600">
                        Biaya operasional berhasil diproses
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-muted-foreground text-sm">
                  {order.operationalFeeStatus === "NOT_APPLICABLE" 
                    ? "Tidak ada biaya operasional untuk pesanan ini"
                    : "Informasi biaya operasional tidak tersedia"}
                </div>
              )}
            </div>

            <h3 className="text-lg font-semibold mt-6 mb-2">Status Timeline</h3>
            <div className="space-y-3">
              <div className="flex items-start">
                <div className="bg-blue-100 p-1 rounded-full mr-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium">Pesanan Dibuat</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDateTime(order.createdAt)}
                  </div>
                </div>
              </div>
              
              {order.driverAssignedAt && (
                <div className="flex items-start">
                  <div className="bg-blue-100 p-1 rounded-full mr-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium">Driver Ditugaskan</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDateTime(order.driverAssignedAt)}
                    </div>
                  </div>
                </div>
              )}
              
              {order.driverAcceptedAt && (
                <div className="flex items-start">
                  <div className="bg-blue-100 p-1 rounded-full mr-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium">Driver Menerima</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDateTime(order.driverAcceptedAt)}
                    </div>
                  </div>
                </div>
              )}
              
              {order.driverArrivedAt && (
                <div className="flex items-start">
                  <div className="bg-blue-100 p-1 rounded-full mr-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium">Driver Tiba</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDateTime(order.driverArrivedAt)}
                    </div>
                  </div>
                </div>
              )}
              
              {order.tripStartedAt && (
                <div className="flex items-start">
                  <div className="bg-blue-100 p-1 rounded-full mr-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium">Perjalanan Dimulai</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDateTime(order.tripStartedAt)}
                    </div>
                  </div>
                </div>
              )}
              
              {order.tripCompletedAt && (
                <div className="flex items-start">
                  <div className="bg-green-100 p-1 rounded-full mr-2">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium">Perjalanan Selesai</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDateTime(order.tripCompletedAt)}
                    </div>
                  </div>
                </div>
              )}
              
              {order.cancelledAt && (
                <div className="flex items-start">
                  <div className="bg-red-100 p-1 rounded-full mr-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <div className="font-medium">Pesanan Dibatalkan</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDateTime(order.cancelledAt)}
                    </div>
                    {order.cancelledReason && (
                      <div className="text-sm text-red-600 mt-1">
                        Alasan: {order.cancelledReason}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}