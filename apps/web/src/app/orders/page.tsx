"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Icons } from "@/components/icons";
import { formatRupiah } from "@/lib/utils";
import { Loader2, Info, Eye, AlertCircle, Filter, X, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { OrderDetailModal } from "@/components/orders/order-detail-modal";
import { OrderStatus } from "@prisma/client";
// Import useToast dari hooks, bukan dari components/ui/use-toast
import { useToast, toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";

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
  // Driver and Fleet info
  driver?: {
    id: string;
    name: string;
    phone: string;
  };
  fleet?: {
    id: string;
    plateNumber: string;
    brand: string;
    model: string;
    color: string;
  };
  // Special requests
  specialRequests?: string;
  // Extracted preferred driver info
  preferredDriver?: {
    name: string;
    plateNumber: string;
  };
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

// Helper untuk mengekstrak informasi driver preferensi
const extractPreferredDriver = (specialRequests?: string) => {
  if (!specialRequests || !specialRequests.includes("Preferred driver:")) {
    return null;
  }
  
  try {
    const driverText = specialRequests.split("Preferred driver:")[1].trim();
    const driverName = driverText.split("(")[0].trim();
    const plateNumber = driverText.match(/\(([^)]+)\)/)?.[1] || "";
    
    return {
      name: driverName,
      plateNumber
    };
  } catch (error) {
    console.error("Error extracting preferred driver:", error);
    return null;
  }
};

function OrderHistoryContent() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>(() => 
    searchParams.get("status") || "all"
  );
  const [plateNumberFilter, setPlateNumberFilter] = useState<string>(() =>
    searchParams.get("plateNumber") || ""
  );
  const [driverNameFilter, setDriverNameFilter] = useState<string>(() =>
    searchParams.get("driverName") || ""
  );
  const [showObserverFilters, setShowObserverFilters] = useState<boolean>(false);
  
  // Cek apakah user adalah Observer
  const isObserver = user?.role === "OBSERVER";

  // Redirect to login if not authenticated
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.push("/login?redirect=/orders");
      return;
    }
  }, [isAuthenticated, authLoading, router]);

  // Fetch orders on mount and when URL params change
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchOrders();
    }
  }, [isAuthenticated, authLoading, currentPage]);

  // Fungsi untuk mendapatkan URL dengan parameter
  const createSearchUrl = useCallback((params: Record<string, string>) => {
    const url = new URL(window.location.href);
    
    // Reset search params
    for (const key of url.searchParams.keys()) {
      url.searchParams.delete(key);
    }
    
    // Add new search params
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
    
    return url.toString();
  }, []);

  // Apply filters and update URL
  const applyFilters = useCallback(() => {
    // Validasi input filter
    const trimmedPlateNumber = plateNumberFilter.trim();
    const trimmedDriverName = driverNameFilter.trim();
    
    // Pastikan setidaknya satu filter diisi
    if (
      (trimmedPlateNumber === "" && trimmedDriverName === "" && statusFilter === "all") ||
      (trimmedPlateNumber.length < 2 && trimmedDriverName.length < 2 && statusFilter === "all")
    ) {
      toast.warning("Filter terlalu umum", 
        "Mohon tentukan filter yang lebih spesifik untuk pencarian yang lebih baik."
      );
      return;
    }
    
    setCurrentPage(1); // Reset page when filters change
    
    const params: Record<string, string> = {};
    if (statusFilter !== "all") params.status = statusFilter;
    if (trimmedPlateNumber) params.plateNumber = trimmedPlateNumber;
    if (trimmedDriverName) params.driverName = trimmedDriverName;
    
    // Update URL with search params without navigation
    const newUrl = createSearchUrl(params);
    window.history.pushState({}, '', newUrl);
    
    // Fetch with new filters
    fetchOrders();
    
  }, [statusFilter, plateNumberFilter, driverNameFilter, createSearchUrl]);
  

  // Reset filters
  const resetFilters = useCallback(() => {
    setStatusFilter("all");
    setPlateNumberFilter("");
    setDriverNameFilter("");
    setCurrentPage(1);
    
    // Reset URL
    window.history.pushState({}, '', window.location.pathname);
    
    // Fetch with reset filters
    fetchOrders();
    
    toast.info("Filter direset", 
      "Menampilkan semua pesanan tanpa filter."
    );
    
  }, []);

  // Fetch orders data
  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
  
    try {
      // Build query params
      const params = new URLSearchParams();
      params.append("page", currentPage.toString());
      params.append("limit", "10");
  
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
  
      // Add filter params for plateNumber and driverName with exact validation
      if (plateNumberFilter && plateNumberFilter.trim() !== "") {
        const trimmedPlateNumber = plateNumberFilter.trim();
        params.append("plateNumber", trimmedPlateNumber);
        console.log("🚗 Frontend: Filtering by plateNumber:", trimmedPlateNumber);
      }
  
      if (driverNameFilter && driverNameFilter.trim() !== "") {
        const trimmedDriverName = driverNameFilter.trim();
        params.append("driverName", trimmedDriverName);
        console.log("👤 Frontend: Filtering by driverName:", trimmedDriverName);
      }
  
      // Log final query parameters
      console.log("Query params:", params.toString());
  
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
        cache: "no-store", // Tambahkan ini untuk memastikan data selalu fresh
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
  
      // Tambahkan validasi hasil filter
      if ((driverNameFilter || plateNumberFilter) && result.data.length > 0) {
        // Log hasil filter untuk debugging
        console.log("Filter applied:", { 
          driverNameFilter, 
          plateNumberFilter, 
          resultCount: result.data.length 
        });
        
        // Log data pertama untuk verifikasi
        if (result.data[0]) {
          console.log("First result driver:", 
            result.data[0].driver?.name || 
            (result.data[0].specialRequests?.includes("Preferred driver:") ? 
              "Preferred: " + result.data[0].specialRequests.split("Preferred driver:")[1].split("(")[0].trim() : 
              "No driver")
          );
        }
      }
  
      // Preprocessed orders with extracted preferred driver info if available
      const processedOrders = result.data.map(order => {
        // Jika tidak ada driver tapi ada special requests dengan preferred driver
        if (!order.driver && order.specialRequests && order.specialRequests.includes("Preferred driver:")) {
          try {
            const preferredDriver = extractPreferredDriver(order.specialRequests);
            if (preferredDriver) {
              return {
                ...order,
                preferredDriver
              };
            }
          } catch (error) {
            console.error("Error extracting preferred driver:", error);
          }
        }
        return order;
      });
  
      setOrders(processedOrders);
      setMeta(result.meta);
      
      // Tambahkan notifikasi hasil filter
      if (driverNameFilter || plateNumberFilter) {
        if (result.data.length === 0) {
          toast.info("Tidak ada hasil", 
            "Tidak ada pesanan yang sesuai dengan kriteria filter."
          );
        } else {
          toast.success(`Ditemukan ${result.data.length} pesanan`, 
            `${result.data.length} pesanan sesuai dengan kriteria filter Anda.`
          );
        }
      }
    } catch (err) {
      console.error("Failed to fetch order history:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data riwayat pesanan"
      );
      
      // Notifikasi error dengan Sonner
      toast.error("Gagal mengambil data", 
        err instanceof Error ? err.message : "Terjadi kesalahan saat mengambil data pesanan"
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
      let detailedOrder = result.success ? result.data : order;
      
      // Process preferred driver info if needed
      if (!detailedOrder.driver && detailedOrder.specialRequests && 
          detailedOrder.specialRequests.includes("Preferred driver:")) {
        
        const preferredDriver = extractPreferredDriver(detailedOrder.specialRequests);
        if (preferredDriver) {
          detailedOrder = {
            ...detailedOrder,
            preferredDriver
          };
        }
      }
      
      setSelectedOrder(detailedOrder);
      setShowDetailModal(true);
    } catch (err) {
      console.error("Failed to fetch order details:", err);
      
      // Notifikasi error dengan Sonner
      toast.error("Gagal mengambil detail", 
        "Terjadi kesalahan saat mengambil detail pesanan"
      );
      
      // Fallback to using the existing order data with preferred driver extraction
      let processedOrder = order;
      
      if (!order.driver && order.specialRequests && 
          order.specialRequests.includes("Preferred driver:")) {
        
        const preferredDriver = extractPreferredDriver(order.specialRequests);
        if (preferredDriver) {
          processedOrder = {
            ...order,
            preferredDriver
          };
        }
      }
      
      setSelectedOrder(processedOrder);
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
        <h1 className="text-2xl font-semibold ms-4 md:ms-0">
          {isObserver ? "Monitor Pesanan (Observer Mode)" : "Riwayat Pesanan"}
        </h1>
        
        <div className="flex items-center gap-2 ms-4 md:ms-0">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              // Tidak langsung trigger fetchOrders disini
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

          {/* Tombol tampilkan filter khusus Observer */}
          {isObserver && (
            <Button
              variant={showObserverFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowObserverFilters(!showObserverFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filter Lanjutan
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrders}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Icons.refresh className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          
          {/* Tambahkan badge khusus untuk Observer */}
          {isObserver && (
            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
              Observer Mode
            </Badge>
          )}
        </div>
      </div>

      {/* Alert Observer Mode */}
      {isObserver && (
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Mode Observer</AlertTitle>
          <AlertDescription className="text-blue-700">
            Anda sedang dalam mode Observer. Anda hanya dapat melihat data pesanan tanpa dapat memodifikasinya.
            Gunakan filter lanjutan untuk menemukan pesanan berdasarkan plat nomor atau nama driver.
          </AlertDescription>
        </Alert>
      )}

      {/* Filter panel khusus Observer - IMPROVED */}
      {isObserver && showObserverFilters && (
  <Card className="border-blue-200 bg-blue-50">
    <CardHeader className="pb-2">
      <CardTitle className="text-lg font-medium">Filter Lanjutan</CardTitle>
      <CardDescription>
        Filter pesanan berdasarkan plat nomor dan nama driver
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="plateNumber" className="text-sm font-medium">
            Plat Nomor Kendaraan
          </label>
          <div className="flex items-center space-x-2">
            <Input
              id="plateNumber"
              value={plateNumberFilter}
              onChange={(e) => setPlateNumberFilter(e.target.value)}
              placeholder="Contoh: BM 1234 AB"
              className="max-w-md"
              // Tambahkan onKeyDown untuk memungkinkan enter key
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applyFilters();
                }
              }}
            />
            {plateNumberFilter && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setPlateNumberFilter("")}
                className="h-8 w-8"
                type="button"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="driverName" className="text-sm font-medium">
            Nama Driver
          </label>
          <div className="flex items-center space-x-2">
            <Input
              id="driverName"
              value={driverNameFilter}
              onChange={(e) => setDriverNameFilter(e.target.value)}
              placeholder="Contoh: Adam Cahyadi"
              className="max-w-md"
              // Tambahkan onKeyDown untuk memungkinkan enter key
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applyFilters();
                }
              }}
            />
            {driverNameFilter && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setDriverNameFilter("")}
                className="h-8 w-8"
                type="button"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button 
          onClick={applyFilters}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Terapkan Filter
        </Button>
        <Button 
          variant="outline" 
          onClick={resetFilters}
          disabled={loading}
        >
          Reset Filter
        </Button>
      </div>
      <div className="mt-2 text-xs text-blue-600">
        <p>
          <strong>Tips:</strong> Gunakan filter plat nomor untuk mencari kendaraan spesifik 
          atau filter nama driver untuk mencari driver tertentu. Pencarian bersifat case-insensitive 
          dan akan mencocokkan sebagian kata.
        </p>
      </div>
    </CardContent>
  </Card>
)}


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
            {isObserver 
              ? "Monitoring semua pesanan dalam sistem" 
              : "Daftar pesanan yang telah Anda lakukan"}
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
                  {/* Kolom tambahan untuk Observer */}
                  {isObserver && (
                    <>
                      <TableHead>Driver</TableHead>
                      <TableHead>Plat Nomor</TableHead>
                    </>
                  )}
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
                      {/* Skeleton untuk kolom tambahan Observer */}
                      {isObserver && (
                        <>
                          <TableCell>
                            <Skeleton className="h-5 w-28" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-5 w-20" />
                          </TableCell>
                        </>
                      )}
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
                    <TableCell 
                      colSpan={isObserver ? 13 : 11} 
                      className="text-center py-6"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Icons.inbox className="h-10 w-10 text-muted-foreground" />
                        <p className="text-muted-foreground font-medium">
                          Tidak ada pesanan ditemukan
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {statusFilter !== "all" || plateNumberFilter || driverNameFilter
                            ? "Coba ubah filter pencarian"
                            : "Belum ada pesanan yang tersedia"}
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

                      {/* Kolom tambahan untuk Observer */}
                      {isObserver && (
                        <>
                          <TableCell>
                            {order.driver ? (
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {order.driver.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {order.driver.phone}
                                </span>
                              </div>
                            ) : order.preferredDriver ? (
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Preferred:</span>
                                <span className="font-medium">
                                  {order.preferredDriver.name}
                                </span>
                              </div>
                            ) : order.specialRequests && order.specialRequests.includes("Preferred driver:") ? (
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Preferred:</span>
                                <span className="font-medium">
                                  {order.specialRequests.split("Preferred driver:")[1].split("(")[0].trim()}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                Tidak ada driver
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {order.fleet ? (
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {order.fleet.plateNumber}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {order.fleet.brand} {order.fleet.model}
                                </span>
                              </div>
                            ) : order.preferredDriver ? (
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {order.preferredDriver.plateNumber}
                                </span>
                              </div>
                            ) : order.specialRequests && order.specialRequests.includes("BM") ? (
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {order.specialRequests.match(/\(([^)]+)\)/)?.[1] || ""}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                Tidak ada kendaraan
                              </span>
                            )}
                          </TableCell>
                        </>
                      )}

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
          isObserver={isObserver}
        />
      )}

      {/* Tambahkan Toaster dari sonner */}
      <Toaster position="top-right" />
    </div>
  );
}

export default function OrderHistoryPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-6"><div className="text-center">Loading...</div></div>}>
      <OrderHistoryContent />
    </Suspense>
  );
}