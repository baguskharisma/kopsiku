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
import { MapPin, Navigation, AlertCircle, Check, Coins, Clock, ArrowUp, ArrowDown, Wallet, Banknote } from "lucide-react";
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
  balanceBeforeOperationalFee?: string;
  balanceAfterOperationalFee?: string;
  operationalFeeTransactionId?: string;
  driverNetEarnings?: string;
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

// Helper to format service fee status (renamed from operational fee)
const formatServiceFeeStatus = (status?: string): string => {
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

// Helper to get service fee status badge color
const getServiceFeeStatusColor = (status?: string): string => {
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

// Helper to format coin balance
const formatCoins = (amount?: string): string => {
  if (!amount) return "0";
  return new Intl.NumberFormat("id-ID").format(parseInt(amount));
};

// Helper to calculate driver net earnings
const calculateDriverNetEarnings = (order: Order): string => {
  try {
    const totalFare = parseInt(order.totalFare) / 100;
    const operationalFeeRupiah = order.operationalFeeCoins ? 
      parseInt(order.operationalFeeCoins) : 0;
    
    const driverNetEarnings = totalFare - operationalFeeRupiah;
    
    // Format TANPA koma - bilangan bulat
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

// Helper to calculate breakdown values
const calculateEarningsBreakdown = (order: Order) => {
  const totalFare = parseInt(order.totalFare) / 100;
  const airportFare = order.airportFare ? parseInt(order.airportFare) / 100 : 0;
  const baseFare = parseInt(order.baseFare) / 100;
  const distanceFare = parseInt(order.distanceFare) / 100;
  
  // Calculate operational fee in Rupiah
  let operationalFeeRupiah = 0;
  if (order.operationalFeeCoins && order.operationalFeePercent) {
    // Convert operational fee from coins to Rupiah (assuming 1 coin = 1 rupiah)
    operationalFeeRupiah = parseInt(order.operationalFeeCoins);
  }
  
  return {
    totalFare,
    airportFare,
    baseFare,
    distanceFare,
    operationalFeeRupiah,
    driverNetEarnings: Math.max(0, totalFare - operationalFeeRupiah), // Driver gets total fare minus operational fee
    platformShare: operationalFeeRupiah, // Operational fee goes to platform
  };
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

  // Format fee rule from service fee config
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

  const earningsBreakdown = calculateEarningsBreakdown(order);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Trip Information */}
          <div className="lg:col-span-2">
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

            {/* Status Timeline */}
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

          {/* Right column - Financial Information */}
          <div>
            {/* Fare Breakdown */}
            <h3 className="text-lg font-semibold mb-2">Rincian Biaya</h3>
            
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>Tarif Dasar</TableCell>
                  <TableCell className="text-right">
                    {formatRupiah(earningsBreakdown.baseFare)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Tarif Jarak</TableCell>
                  <TableCell className="text-right">
                    {formatRupiah(earningsBreakdown.distanceFare)}
                  </TableCell>
                </TableRow>
                {earningsBreakdown.airportFare > 0 && (
                  <TableRow>
                    <TableCell>Tarif Bandara</TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(earningsBreakdown.airportFare)}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="font-medium">
                  <TableCell>Total Tarif</TableCell>
                  <TableCell className="text-right">
                    {formatRupiah(earningsBreakdown.totalFare)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            {/* Driver Earnings Section */}
            <h3 className="text-lg font-semibold mt-6 mb-2">Pendapatan Driver</h3>
            
            <div className="rounded-md border p-4 space-y-3">
  <div className="flex justify-between items-center">
    <div className="flex items-center">
      <Banknote className="h-5 w-5 mr-2 text-green-600" />
      <span>Netto</span>
    </div>
    <div className="font-bold text-green-700 text-lg">
      {formatRupiah(earningsBreakdown.driverNetEarnings)}
    </div>
  </div>
  
  <Separator />
  
  <div className="space-y-2 text-sm">
    <div className="flex justify-between">
      <span>Total Tarif</span>
      <span>{formatRupiah(earningsBreakdown.totalFare)}</span>
    </div>
    
    {earningsBreakdown.operationalFeeRupiah > 0 && (
      <div className="flex justify-between text-red-600">
        <span>Biaya Layanan Platform</span>
        <span>-{formatRupiah(earningsBreakdown.operationalFeeRupiah)}</span>
      </div>
    )}
    
    <Separator />
    
    <div className="flex justify-between font-medium text-green-700">
      <span>Yang Diterima Driver</span>
      <span>{formatRupiah(earningsBreakdown.driverNetEarnings)}</span>
    </div>
  </div>
  
  {earningsBreakdown.operationalFeeRupiah > 0 && (
    <div className="bg-blue-50 p-2 rounded-md">
      <div className="text-xs text-blue-600">
        <strong>Catatan:</strong> Biaya layanan platform digunakan untuk operasional sistem dan tidak diberikan kepada driver. Cas bandara (jika ada) dibebankan langsung ke penumpang.
      </div>
    </div>
  )}
</div>

            {/* Service Fee Section */}
            <h3 className="text-lg font-semibold mt-6 mb-2">Biaya Layanan</h3>
            
            <div className="rounded-md border p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <Coins className="h-5 w-5 mr-2 text-blue-600" />
                  <span>Status Pembayaran</span>
                </div>
                <Badge
                  className={`${getServiceFeeStatusColor(order.operationalFeeStatus)} text-white`}
                >
                  {formatServiceFeeStatus(order.operationalFeeStatus)}
                </Badge>
              </div>
              
              {order.operationalFeeCoins && parseInt(order.operationalFeeCoins) > 0 ? (
                <>
                  <Separator />
                  
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Jumlah Biaya Layanan</div>
                      <div className="font-medium text-lg">
                        {formatCoins(order.operationalFeeCoins)} coins
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
                  
                  <Separator />

                  {/* Balance Information */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Informasi Saldo</h4>
                    
                    {order.balanceBeforeOperationalFee && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <ArrowUp className="h-4 w-4 text-gray-600 mr-2" />
                          <span className="text-sm">Saldo Sebelum</span>
                        </div>
                        <div className="font-medium">
                          {formatCoins(order.balanceBeforeOperationalFee)} coins
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-red-600">
                      <div className="flex items-center">
                        <ArrowDown className="h-4 w-4 mr-2" />
                        <span className="text-sm">Pengurangan</span>
                      </div>
                      <div className="font-medium">
                        -{formatCoins(order.operationalFeeCoins)} coins
                      </div>
                    </div>
                    
                    {order.balanceAfterOperationalFee && (
                      <div className="flex items-center justify-between border-t pt-2">
                        <div className="flex items-center">
                          <Coins className="h-4 w-4 text-green-600 mr-2" />
                          <span className="text-sm font-medium">Saldo Setelah</span>
                        </div>
                        <div className="font-bold text-green-600">
                          {formatCoins(order.balanceAfterOperationalFee)} coins
                        </div>
                      </div>
                    )}
                    
                    {order.operationalFeeTransactionId && (
                      <div className="text-xs text-muted-foreground">
                        ID Transaksi: {order.operationalFeeTransactionId}
                      </div>
                    )}
                  </div>

                  <Separator />
                  
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
                        Gagal memproses biaya layanan. Silakan hubungi layanan pelanggan.
                      </div>
                    </div>
                  )}
                  
                  {order.operationalFeeStatus === "CHARGED" && (
                    <div className="bg-green-50 p-2 rounded-md flex items-start">
                      <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-green-600">
                        Biaya layanan berhasil diproses
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-muted-foreground text-sm">
                  {order.operationalFeeStatus === "NOT_APPLICABLE" 
                    ? "Tidak ada biaya layanan untuk pesanan ini"
                    : "Informasi biaya layanan tidak tersedia"}
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