"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useAuth } from "@/lib/use-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Icons } from "@/components/icons";
import { formatRupiah } from "@/lib/utils";
import { Loader2, Info, Eye, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OrderDetailModal } from "@/components/orders/order-detail-modal";
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
  // Balance fields
  balanceBeforeOperationalFee?: string;
  balanceAfterOperationalFee?: string;
  operationalFeeTransactionId?: string;
  // New driver earnings field
  driverNetEarnings?: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface OrdersResponse {
  success: boolean;
  data: Order[];
  meta: PaginationMeta;
  message: string;
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

export default function OrderHistoryPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  // State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Fetch orders on mount and when filters change
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.push("/login?redirect=/dashboard/orders");
      return;
    }

    fetchOrders();
  }, [isAuthenticated, authLoading, currentPage, statusFilter, router]);

  // Fetch orders data
  const fetchOrders = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
      });

      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      // Ambil backend URL dari environment variable atau gunakan default
      const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
      const apiUrl = `${backendUrl}/orders?${params.toString()}`;
      
      console.log('Fetching orders from:', apiUrl);

      const response = await fetch(apiUrl, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error response:', errorText);
        throw new Error(`Error fetching orders: ${response.status} ${response.statusText}`);
      }

      const result: OrdersResponse = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to fetch orders");
      }

      setOrders(result.data);
      setMeta(result.meta);
    } catch (err) {
      console.error("Failed to fetch order history:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data riwayat pesanan"
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle view detail
  const handleViewDetail = async (order: Order) => {
    try {
      // If we need more detailed data for the order
      const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
      const apiUrl = `${backendUrl}/orders/${order.id}`;
      
      console.log('Fetching order details from:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Error fetching order details: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Use either detailed data or the original order data
      const detailedOrder = result.success ? result.data : order;
      
      setSelectedOrder(detailedOrder);
      setShowDetailModal(true);
    } catch (err) {
      console.error("Failed to fetch order details:", err);
      // Fallback to using the existing order data
      setSelectedOrder(order);
      setShowDetailModal(true);
    }
  };

  // Calculate the page range to display
  const getPageRange = () => {
    if (!meta) return [];
    
    const totalPages = meta.totalPages;
    const currentPageNum = currentPage;
    
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    if (currentPageNum <= 3) {
      return [1, 2, 3, 4, 5];
    }
    
    if (currentPageNum >= totalPages - 2) {
      return [
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }
    
    return [
      currentPageNum - 2,
      currentPageNum - 1,
      currentPageNum,
      currentPageNum + 1,
      currentPageNum + 2,
    ];
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold ms-4 md:ms-0">Riwayat Pesanan</h1>
        
        <div className="flex items-center gap-2 ms-4 md:ms-0">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Status Pesanan</SelectLabel>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="COMPLETED">Selesai</SelectItem>
                <SelectItem value="IN_PROGRESS">Dalam Perjalanan</SelectItem>
                <SelectItem value="DRIVER_ARRIVING">Driver Menuju</SelectItem>
                <SelectItem value="DRIVER_ACCEPTED">Driver Menerima</SelectItem>
                <SelectItem value="DRIVER_ASSIGNED">Driver Ditugaskan</SelectItem>
                <SelectItem value="PENDING">Menunggu Driver</SelectItem>
                <SelectItem value="CANCELLED_BY_CUSTOMER">Dibatalkan Penumpang</SelectItem>
                <SelectItem value="CANCELLED_BY_DRIVER">Dibatalkan Driver</SelectItem>
                <SelectItem value="CANCELLED_BY_SYSTEM">Dibatalkan Sistem</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOrders()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Icons.refresh className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-none outline-none shadow-none">
        <CardHeader>
          <CardTitle>Daftar Pesanan</CardTitle>
          <CardDescription>
            Daftar pesanan yang telah Anda lakukan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Pesanan</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rute</TableHead>
                  <TableHead>Tipe Kendaraan</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Biaya Layanan</TableHead>
                  <TableHead>Netto</TableHead>
                  <TableHead>Saldo Sebelum</TableHead>
                  <TableHead>Saldo Setelah</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  // Loading skeleton
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-9 w-9 rounded-md ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : orders.length === 0 ? (
                  // Empty state
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-6">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Icons.inbox className="h-10 w-10 text-muted-foreground" />
                        <p className="text-muted-foreground font-medium">
                          Tidak ada pesanan ditemukan
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {statusFilter !== "all"
                            ? "Coba ubah filter status"
                            : "Anda belum memiliki pesanan"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  // Order list
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell>
                        {format(new Date(order.createdAt), "dd MMM yyyy HH:mm", {
                          locale: id,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${
                            statusColorMap[order.status as OrderStatus]
                          } text-white`}
                        >
                          {formatStatus(order.status as OrderStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">
                            Dari:
                          </span>
                          <span className="truncate max-w-28 md:max-w-xs">
                            {order.pickupAddress}
                          </span>
                          <span className="text-xs text-muted-foreground mt-1">
                            Ke:
                          </span>
                          <span className="truncate max-w-28 md:max-w-xs">
                            {order.dropoffAddress}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.requestedVehicleType === "ECONOMY"
                          ? "Ekonomi"
                          : order.requestedVehicleType === "PREMIUM"
                          ? "Premium"
                          : order.requestedVehicleType === "LUXURY"
                          ? "Luxury"
                          : order.requestedVehicleType === "MOTORCYCLE"
                          ? "Motor"
                          : order.requestedVehicleType}
                      </TableCell>
                      <TableCell>
                        {formatRupiah(parseInt(order.totalFare) / 100)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <Badge
                            className={`mb-1 w-fit ${getServiceFeeStatusColor(
                              order.operationalFeeStatus
                            )} text-white`}
                          >
                            {formatServiceFeeStatus(
                              order.operationalFeeStatus
                            )}
                          </Badge>
                          {order.operationalFeeCoins && (
                            <span className="text-sm">
                              {formatCoins(order.operationalFeeCoins)} coins
                            </span>
                          )}
                          {order.operationalFeePercent && (
                            <span className="text-xs text-muted-foreground">
                              ({(order.operationalFeePercent * 100).toFixed(1)}%)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-green-700">
                          {calculateDriverNetEarnings(order)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {order.balanceBeforeOperationalFee ? (
                            <>
                              <span className="font-medium">
                                {formatCoins(order.balanceBeforeOperationalFee)}
                              </span>
                              <span className="text-muted-foreground ml-1">
                                coins
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {order.balanceAfterOperationalFee ? (
                            <>
                              <span className="font-medium">
                                {formatCoins(order.balanceAfterOperationalFee)}
                              </span>
                              <span className="text-muted-foreground ml-1">
                                coins
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDetail(order)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && !loading && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    isActive={currentPage > 1}
                  />
                </PaginationItem>
                
                {getPageRange().map((pageNum) => (
                  <PaginationItem key={`page-${pageNum}`}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNum)}
                      isActive={currentPage === pageNum}
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setCurrentPage(
                        Math.min(meta.totalPages, currentPage + 1)
                      )
                    }
                    isActive={currentPage < meta.totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}

          {meta && (
            <div className="text-xs text-muted-foreground mt-2 text-center">
              Menampilkan {orders.length} dari {meta.total} pesanan
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedOrder(null);
          }}
          order={selectedOrder}
        />
      )}
    </div>
  );
}