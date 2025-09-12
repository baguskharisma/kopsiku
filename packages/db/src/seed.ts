import { PrismaClient, Role, FleetType, FleetStatus, VehicleType, DriverStatus, LocationCategory, TripType, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import prompts from 'prompts';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const hashPassword = async (password: string) => {
  if (!password) return null;
  return bcrypt.hash(password, 10);
};

type MenuOption =
  | 'appConfig'
  | 'user'
  | 'driverProfile'
  | 'fleet'
  | 'fleetAssignment'
  | 'pricingRule'
  | 'location'
  | 'userLocation'
  | 'order'
  | 'payment'
  | 'rating'
  | 'driverStatusHistory'
  | 'otp'
  | 'refreshToken'
  | 'auditLog'
  | 'bulkSeedFleetData'
  | 'exit';

async function createAppConfigInteractive() {
  const response = await prompts([
    { name: 'key', type: 'text', message: 'Key (ex: APP_NAME)' },
    { name: 'value', type: 'text', message: 'Value' },
    { name: 'description', type: 'text', message: 'Description', initial: '' },
    { name: 'type', type: 'select', message: 'Type', choices: [
      { title: 'string', value: 'string' },
      { title: 'number', value: 'number' },
      { title: 'boolean', value: 'boolean' },
    ], initial: 0 },
    { name: 'isPublic', type: 'confirm', message: 'Is public?' , initial: true },
  ]);

  if (!response.key) {
    console.log('Skipped (no key provided).');
    return;
  }

  const createData = {
    key: response.key,
    value: response.value,
    description: response.description || null,
    type: response.type,
    isPublic: response.isPublic,
    updatedBy: 'manual-seeder',
  };

  const item = await prisma.appConfig.upsert({
    where: { key: createData.key },
    update: createData,
    create: createData,
  });

  console.log('Created/Updated appConfig: ', item.key);
}

async function createUserInteractive() {
  const resp = await prompts([
    { name: 'name', type: 'text', message: 'Name' },
    { name: 'username', type: 'text', message: 'Username' },
    { name: 'email', type: 'text', message: 'Email (optional)', initial: '' },
    { name: 'phone', type: 'text', message: 'Phone' },
    { name: 'password', type: 'password', message: 'Password (leave empty to auto-generate "Password123!")' },
    { name: 'role', type: 'select', message: 'Role', choices: [
      { title: 'SUPER_ADMIN', value: Role.SUPER_ADMIN },
      { title: 'ADMIN', value: Role.ADMIN },
      { title: 'DRIVER', value: Role.DRIVER },
      { title: 'CUSTOMER', value: Role.CUSTOMER },
    ], initial: 3 },
    { name: 'isActive', type: 'confirm', message: 'isActive?', initial: true },
    { name: 'isVerified', type: 'confirm', message: 'isVerified?', initial: false },
  ]);

  if (!resp.name || !resp.username || !resp.phone) {
    console.log('Missing required fields. Aborting user create.');
    return;
  }

  const pwd = resp.password || 'Password123!';
  const passwordHash = await hashPassword(pwd);

  const user = await prisma.user.create({
    data: {
      name: resp.name,
      username: resp.username,
      email: resp.email || null,
      phone: resp.phone,
      passwordHash: passwordHash || '',
      role: resp.role,
      isActive: resp.isActive,
      isVerified: resp.isVerified,
      lastLoginAt: new Date(),
    },
  });

  console.log('Created user:', user.id, user.username);
  if (!resp.password) console.log(`Default password used: ${pwd}`);
}

async function createFleetInteractive() {
  const resp = await prompts([
    { name: 'plateNumber', type: 'text', message: 'Plate number (ex: BM 1856 QU)' },
    { name: 'type', type: 'select', message: 'Fleet type', choices: [
      { title: 'CAR_SMALL', value: FleetType.CAR_SMALL },
      { title: 'TRAVEL', value: FleetType.TRAVEL },
      { title: 'TAXI', value: FleetType.TAXI },
    ], initial: 0 },
    { name: 'model', type: 'text', message: 'Model', initial: 'Calya' },
    { name: 'brand', type: 'text', message: 'Brand', initial: 'Toyota' },
    { name: 'year', type: 'number', message: 'Year', initial: 2021 },
    { name: 'color', type: 'text', message: 'Color', initial: 'Putih' },
    { name: 'capacity', type: 'number', message: 'Capacity', initial: 6 },
    { name: 'vehicleType', type: 'select', message: 'Vehicle type', choices: [
      { title: 'ECONOMY', value: VehicleType.ECONOMY },
      { title: 'PREMIUM', value: VehicleType.PREMIUM },
    ], initial: 0 },
    { name: 'status', type: 'select', message: 'Status', choices: [
      { title: 'ACTIVE', value: FleetStatus.ACTIVE },
      { title: 'INACTIVE', value: FleetStatus.OUT_OF_SERVICE },
    ], initial: 0 },
    { name: 'extraJson', type: 'text', message: 'Optional JSON for extra fields (engineNumber, insuranceExpiry...), leave empty to skip', initial: '' },
  ]);

  if (!resp.plateNumber) {
    console.log('Skipped fleet (no plate number).');
    return;
  }

  let extra = {};
  if (resp.extraJson) {
    try { extra = JSON.parse(resp.extraJson); } catch (e) { console.log('Invalid JSON, ignored extra fields.'); }
  }

  const fleet = await prisma.fleet.create({
    data: {
      type: resp.type,
      plateNumber: resp.plateNumber,
      model: resp.model,
      brand: resp.brand,
      year: resp.year,
      color: resp.color,
      capacity: resp.capacity,
      status: resp.status,
      vehicleType: resp.vehicleType,
      basePriceMultiplier: (extra as any).basePriceMultiplier ?? 1,
      engineNumber: (extra as any).engineNumber ?? null,
      chassisNumber: (extra as any).chassisNumber ?? null,
      registrationExpiry: (extra as any).registrationExpiry ? new Date((extra as any).registrationExpiry) : null,
      insuranceExpiry: (extra as any).insuranceExpiry ? new Date((extra as any).insuranceExpiry) : null,
      lastMaintenanceAt: (extra as any).lastMaintenanceAt ? new Date((extra as any).lastMaintenanceAt) : null,
      nextMaintenanceAt: (extra as any).nextMaintenanceAt ? new Date((extra as any).nextMaintenanceAt) : null,
    },
  });

  console.log('Created fleet:', fleet.id, fleet.plateNumber);
}

async function createDriverProfileInteractive() {
  // Expects that user record already exists and you provide userId
  const resp = await prompts([
    { name: 'userId', type: 'text', message: 'User ID (must be existing user with role DRIVER)' },
    { name: 'licenseNumber', type: 'text', message: 'License number', initial: 'SIM-1234567890' },
    { name: 'licenseExpiry', type: 'text', message: 'License expiry (YYYY-MM-DD) or empty', initial: '' },
    { name: 'idCardNumber', type: 'text', message: 'ID card number', initial: '' },
    { name: 'address', type: 'text', message: 'Address', initial: '' },
    { name: 'bankAccount', type: 'text', message: 'Bank account (optional)', initial: '' },
    { name: 'bankName', type: 'text', message: 'Bank name (optional)', initial: '' },
    { name: 'rating', type: 'number', message: 'Rating (1-5, optional)', initial: 4.5 },
    { name: 'currentLat', type: 'number', message: 'Current latitude', initial: 0.5333 },
    { name: 'currentLng', type: 'number', message: 'Current longitude', initial: 101.45 },
    { name: 'driverStatus', type: 'select', message: 'Driver status', choices: [
      { title: 'ACTIVE', value: DriverStatus.ACTIVE },
      { title: 'OFFLINE', value: DriverStatus.OFFLINE },
      { title: 'BUSY', value: DriverStatus.BUSY },
    ], initial: 0 },
    { name: 'preferredVehicleTypesJson', type: 'text', message: 'Preferred vehicle types as JSON array (ex: ["ECONOMY"]) or empty', initial: '["ECONOMY"]' },
  ]);

  if (!resp.userId) { console.log('UserId is required'); return; }

  let pref: any[] = [];
  try { pref = JSON.parse(resp.preferredVehicleTypesJson || '[]'); } catch { pref = ['ECONOMY']; }

  const profile = await prisma.driverProfile.create({
    data: {
      userId: resp.userId,
      licenseNumber: resp.licenseNumber || null,
      licenseExpiry: resp.licenseExpiry 
      ? new Date(resp.licenseExpiry) 
      : new Date('2030-01-01'),
      idCardNumber: resp.idCardNumber || null,
      address: resp.address || 'Jl. Transportasi No. 1, Pekanbaru',
      emergencyContact: '',
      bankAccount: resp.bankAccount || null,
      bankName: resp.bankName || null,
      isVerified: false,
      rating: resp.rating ?? 0,
      totalTrips: 0,
      completedTrips: 0,
      cancelledTrips: 0,
      totalEarnings: BigInt(0),
      currentLat: resp.currentLat ?? 0,
      currentLng: resp.currentLng ?? 0,
      lastLocationUpdate: new Date(),
      driverStatus: resp.driverStatus,
      statusChangedAt: new Date(),
      maxRadius: 10,
      preferredVehicleTypes: pref as any,
    },
  });

  console.log('Created driver profile id:', profile.id);
}

async function createFleetAssignmentInteractive() {
  console.log('\n🔗 Create Fleet Assignment (interactive)\n');

  // Ambil fleets aktif (limit supaya daftar tidak terlalu panjang)
  const fleets = await prisma.fleet.findMany({
    where: {},
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  if (!fleets || fleets.length === 0) {
    console.log('⚠️ Tidak ada fleets di DB. Buat fleet dulu sebelum membuat assignment.');
    return;
  }

  // Ambil drivers (users with role DRIVER)
  const drivers = await prisma.user.findMany({
    where: { role: 'DRIVER' },
    orderBy: { name: 'asc' },
    take: 200,
  });

  if (!drivers || drivers.length === 0) {
    console.log('⚠️ Tidak ada driver users di DB. Buat user role DRIVER dulu.');
    return;
  }

  // Build choices
  const fleetChoices = fleets.map(f => ({
    title: `${f.plateNumber} — ${f.brand} ${f.model} (${f.year}) [${f.status}]`,
    value: f.id,
    description: f.id,
  }));

  const driverChoices = drivers.map(d => ({
    title: `${d.name} — ${d.phone} (${d.username ?? 'no-username'})`,
    value: d.id,
    description: d.id,
  }));

  const resp = await prompts([
    {
      name: 'fleetId',
      type: 'select',
      message: 'Pilih fleet untuk di-assign',
      choices: fleetChoices,
      hint: 'Use arrow keys to choose',
    },
    {
      name: 'driverId',
      type: 'select',
      message: 'Pilih driver (user) yang akan ditugaskan',
      choices: driverChoices,
    },
    {
      name: 'startedAt',
      type: 'text',
      message: 'Started at (ISO datetime) — kosong berarti sekarang',
      initial: new Date().toISOString(),
    },
    {
      name: 'notes',
      type: 'text',
      message: 'Notes (opsional)',
      initial: 'Initial fleet assignment',
    },
    {
      name: 'isActive',
      type: 'confirm',
      message: 'Set assignment aktif sekarang?',
      initial: true,
    },
  ]);

  if (!resp.fleetId || !resp.driverId) {
    console.log('Canceled: fleet atau driver tidak dipilih.');
    return;
  }

  // Parse startedAt
  const startedAt = resp.startedAt ? new Date(resp.startedAt) : new Date();
  if (isNaN(startedAt.getTime())) {
    console.log('Invalid startedAt. Gunakan ISO-8601 (contoh: 2025-09-02T08:00:00.000Z).');
    return;
  }

  // Cek konflik: fleetId + isActive=true, driverId + isActive=true
  const existingFleetActive = await prisma.fleetAssignment.findFirst({
    where: { fleetId: resp.fleetId, isActive: true },
  });

  const existingDriverActive = await prisma.fleetAssignment.findFirst({
    where: { driverId: resp.driverId, isActive: true },
  });

  // Jika ada konflik, tawarkan untuk menonaktifkan yang lama
  if (existingFleetActive || existingDriverActive) {
    console.log('\n⚠️ Konflik assignment ditemukan:');
    if (existingFleetActive) {
      console.log(` - Fleet sudah ada assignment aktif (id: ${existingFleetActive.id}, driverId: ${existingFleetActive.driverId})`);
    }
    if (existingDriverActive) {
      console.log(` - Driver sudah ada assignment aktif (id: ${existingDriverActive.id}, fleetId: ${existingDriverActive.fleetId})`);
    }

    const resolveResp = await prompts({
      name: 'action',
      type: 'select',
      message: 'Bagaimana menyelesaikan konflik?',
      choices: [
        { title: 'Non-aktifkan assignment lama (recommended)', value: 'deactivate' },
        { title: 'Batalkan pembuatan assignment baru', value: 'cancel' },
      ],
      initial: 0,
    });

    if (resolveResp.action === 'cancel') {
      console.log('Dibatalkan oleh user — tidak ada perubahan.');
      return;
    }

    if (resolveResp.action === 'deactivate') {
      // Non-aktifkan assignment lama untuk fleet atau driver (set isActive=false dan endedAt)
      const updates: Promise<any>[] = [];

      if (existingFleetActive) {
        updates.push(
          prisma.fleetAssignment.update({
            where: { id: existingFleetActive.id },
            data: { isActive: false, endedAt: new Date(), notes: `${existingFleetActive.notes ?? ''} — auto-deactivated by seeder` },
          })
        );
      }

      if (existingDriverActive && (!existingFleetActive || existingDriverActive.id !== existingFleetActive?.id)) {
        updates.push(
          prisma.fleetAssignment.update({
            where: { id: existingDriverActive.id },
            data: { isActive: false, endedAt: new Date(), notes: `${existingDriverActive.notes ?? ''} — auto-deactivated by seeder` },
          })
        );
      }

      await Promise.all(updates);
      console.log('✅ Assignment lama dinon-aktifkan.');
    }
  }

  // Create new assignment
  try {
    const created = await prisma.fleetAssignment.create({
      data: {
        fleetId: resp.fleetId,
        driverId: resp.driverId,
        isActive: !!resp.isActive,
        startedAt,
        endedAt: resp.isActive ? null : new Date(),
        notes: resp.notes || null,
      },
    });

    console.log(`✅ Fleet assignment dibuat (id: ${created.id}) — fleetId: ${created.fleetId}, driverId: ${created.driverId}, isActive: ${created.isActive}`);
  } catch (err: any) {
    console.error('❌ Gagal membuat fleet assignment:', err.message || err);
  }
}

async function createLocationInteractive() {
  const resp = await prompts([
    { name: 'name', type: 'text', message: 'Location name (ex: Mall SKA)' },
    { name: 'address', type: 'text', message: 'Address' },
    { name: 'lat', type: 'number', message: 'Latitude', initial: 0.5333 },
    { name: 'lng', type: 'number', message: 'Longitude', initial: 101.45 },
    { name: 'category', type: 'select', message: 'Category', choices: [
      { title: 'POPULAR', value: LocationCategory.POPULAR },
      { title: 'RECENT', value: LocationCategory.RECENT },
      { title: 'HOME', value: LocationCategory.HOME },
      { title: 'WORK', value: LocationCategory.WORK },
      { title: 'FAVORITE', value: LocationCategory.FAVORITE },
    ], initial: 0 },
    { name: 'description', type: 'text', message: 'Description', initial: '' },
    { name: 'icon', type: 'text', message: 'Icon', initial: 'map-pin' },
  ]);

  if (!resp.name) { console.log('Name required'); return; }

  const location = await prisma.location.create({
    data: {
      name: resp.name,
      address: resp.address || null,
      lat: resp.lat,
      lng: resp.lng,
      category: resp.category,
      icon: resp.icon || 'map-pin',
      description: resp.description || null,
      isActive: true,
      searchCount: 0,
    },
  });

  console.log('Created location:', location.id, location.name);
}

async function createOrderInteractive() {
  console.log('NOTE: This interactive order creator accepts basic fields. For complex payloads, when asked you can paste JSON for advanced fields.');
  const resp = await prompts([
    { name: 'customerId', type: 'text', message: 'Customer ID (required)' },
    { name: 'driverId', type: 'text', message: 'Driver ID (optional)', initial: '' },
    { name: 'fleetId', type: 'text', message: 'Fleet ID (optional)', initial: '' },
    { name: 'orderNumber', type: 'text', message: 'Order number (leave empty to auto-generate)' },
    { name: 'tripType', type: 'select', message: 'Trip type', choices: [
      { title: 'INSTANT', value: TripType.INSTANT },
      { title: 'SCHEDULED', value: TripType.SCHEDULED },
    ], initial: 0 },
    { name: 'scheduledAt', type: 'text', message: 'Scheduled at (YYYY-MM-DD HH:mm) or empty', initial: '' },
    { name: 'pickupAddress', type: 'text', message: 'Pickup address', initial: 'Jl. Example' },
    { name: 'pickupLat', type: 'number', message: 'Pickup lat', initial: 0.5333 },
    { name: 'pickupLng', type: 'number', message: 'Pickup lng', initial: 101.45 },
    { name: 'dropoffAddress', type: 'text', message: 'Dropoff address', initial: 'Jl. Tujuan' },
    { name: 'dropoffLat', type: 'number', message: 'Dropoff lat', initial: 0.539 },
    { name: 'dropoffLng', type: 'number', message: 'Dropoff lng', initial: 101.46 },
    { name: 'requestedVehicleType', type: 'select', message: 'Vehicle type', choices: [
      { title: 'ECONOMY', value: VehicleType.ECONOMY },
      { title: 'PREMIUM', value: VehicleType.PREMIUM },
    ], initial: 0 },
    { name: 'distanceMeters', type: 'number', message: 'Distance meters', initial: 5000 },
    { name: 'estimatedDurationMinutes', type: 'number', message: 'Estimated duration minutes', initial: 15 },
    { name: 'totalFare', type: 'number', message: 'Total fare (in IDR)', initial: 100000 },
    { name: 'paymentMethod', type: 'select', message: 'Payment method', choices: [
      { title: 'CASH', value: PaymentMethod.CASH },
      { title: 'QRIS', value: PaymentMethod.QRIS },
      { title: 'EWALLET', value: PaymentMethod.EWALLET },
      { title: 'BANK_TRANSFER', value: PaymentMethod.BANK_TRANSFER },
    ], initial: 0 },
    { name: 'status', type: 'select', message: 'Order status', choices: [
      { title: 'PENDING', value: OrderStatus.PENDING },
      { title: 'COMPLETED', value: OrderStatus.COMPLETED },
      { title: 'CANCELLED_BY_CUSTOMER', value: OrderStatus.CANCELLED_BY_CUSTOMER },
    ], initial: 0 },
    { name: 'extraJson', type: 'text', message: 'Optional extra JSON for advanced fields (driverAssignedAt, driverAcceptedAt, surgeFare, etc.)', initial: '' },
  ]);

  if (!resp.customerId) { console.log('customerId required'); return; }

  const generateOrderNumber = () => {
    const prefix = 'KOP';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  };

  let extra: any = {};
  if (resp.extraJson) {
    try { extra = JSON.parse(resp.extraJson); } catch (e) { console.log('Invalid JSON in extraJson, ignoring'); }
  }

  const order = await prisma.order.create({
    data: {
      customerId: resp.customerId,
      driverId: resp.driverId || null,
      fleetId: resp.fleetId || null,
      orderNumber: resp.orderNumber || generateOrderNumber(),
      tripType: resp.tripType,
      scheduledAt: resp.scheduledAt ? new Date(resp.scheduledAt) : null,
      passengerName: extra.passengerName || "Default Passenger",
      passengerPhone: extra.passengerPhone || "6281234567890",
      specialRequests: extra.specialRequests || null,
      pickupAddress: resp.pickupAddress,
      pickupLat: resp.pickupLat,
      pickupLng: resp.pickupLng,
      dropoffAddress: resp.dropoffAddress,
      dropoffLat: resp.dropoffLat,
      dropoffLng: resp.dropoffLng,
      requestedVehicleType: resp.requestedVehicleType,
      distanceMeters: resp.distanceMeters,
      estimatedDurationMinutes: resp.estimatedDurationMinutes,
      actualDurationMinutes: extra.actualDurationMinutes ?? null,
      baseFare: BigInt(extra.baseFare ?? 50000),
      distanceFare: BigInt(extra.distanceFare ?? 30000),
      timeFare: BigInt(extra.timeFare ?? 20000),
      airportFare: BigInt(extra.airportFare ?? 0),
      surgeFare: BigInt(extra.surgeFare ?? 0),
      additionalFare: BigInt(extra.additionalFare ?? 0),
      discount: BigInt(extra.discount ?? 0),
      totalFare: BigInt(resp.totalFare),
      paymentMethod: resp.paymentMethod,
      paymentStatus: resp.status === OrderStatus.COMPLETED ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
      status: resp.status,
      driverAssignedAt: extra.driverAssignedAt ? new Date(extra.driverAssignedAt) : null,
      driverAcceptedAt: extra.driverAcceptedAt ? new Date(extra.driverAcceptedAt) : null,
      driverArrivedAt: extra.driverArrivedAt ? new Date(extra.driverArrivedAt) : null,
      tripStartedAt: extra.tripStartedAt ? new Date(extra.tripStartedAt) : null,
      tripCompletedAt: extra.tripCompletedAt ? new Date(extra.tripCompletedAt) : null,
      cancelledAt: extra.cancelledAt ? new Date(extra.cancelledAt) : null,
      cancelledReason: extra.cancelledReason ?? null,
      cancellationFee: BigInt(extra.cancellationFee ?? 0),
      idempotencyKey: extra.idempotencyKey ?? null,
      createdAt: extra.createdAt ? new Date(extra.createdAt) : new Date(),
    },
  });

  console.log('Created order:', order.id, order.orderNumber);
}

// Fungsi untuk generate random SIM number
function generateLicenseNumber() {
  const prefix = 'SIM';
  const randomNum = Math.floor(10000000000 + Math.random() * 90000000000);
  return `${prefix}-${randomNum}`;
}

// Fungsi untuk generate random KTP number
function generateIdCardNumber() {
  // Format KTP Indonesia: 16 digit
  return Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString();
}

// Fungsi untuk generate alamat random
function generateRandomAddress() {
  const streets = [
    'Jl. Sudirman', 'Jl. Ahmad Yani', 'Jl. Diponegoro', 'Jl. Gajah Mada', 
    'Jl. Harapan Raya', 'Jl. Thamrin', 'Jl. Hang Tuah', 'Jl. Kartini', 
    'Jl. Tuanku Tambusai', 'Jl. HR. Soebrantas'
  ];
  const districts = ['Tampan', 'Payung Sekaki', 'Bukit Raya', 'Tenayan Raya', 'Marpoyan Damai', 'Lima Puluh', 'Sail'];
  
  const street = streets[Math.floor(Math.random() * streets.length)];
  const number = Math.floor(1 + Math.random() * 200);
  const district = districts[Math.floor(Math.random() * districts.length)];
  
  return `${street} No. ${number}, ${district}, Pekanbaru`;
}

// Fungsi untuk memformat nomor telepon
function formatPhoneNumber(phone: string): string {
  // Bersihkan nomor telepon dari semua karakter non-numerik
  const cleanedPhone = phone.replace(/\D/g, '');
  
  // Pastikan nomor diawali dengan kode negara Indonesia
  if (cleanedPhone.startsWith('62')) {
    return cleanedPhone;
  } else if (cleanedPhone.startsWith('0')) {
    return `62${cleanedPhone.substring(1)}`;
  } else {
    return `62${cleanedPhone}`;
  }
}

// Fungsi untuk membuat username berdasarkan nama
function generateUsername(name: string): string {
  // Hapus spasi dan ubah ke lowercase
  const baseName = name.toLowerCase().replace(/\s+/g, '');
  
  // Tambahkan angka random di belakang untuk keunikan
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `${baseName}${randomNum}`;
}

// Data armada dan driver yang akan diseed
const fleetData = [
  { plateNumber: 'BM 1856 QU', driverName: 'Endrizal', driverPhone: '08126850120' },
  { plateNumber: 'BM 1858 QU', driverName: 'Syamsuddin', driverPhone: '081270432500' },
  { plateNumber: 'BM 1860 QU', driverName: 'Safrizal', driverPhone: '085274658457' },
  { plateNumber: 'BM 1862 QU', driverName: 'Mardianto', driverPhone: '088279086838' },
  { plateNumber: 'BM 1863 QU', driverName: 'Syafrizal', driverPhone: '081378334227' },
  { plateNumber: 'BM 1865 QU', driverName: 'Hotler Sibagariang', driverPhone: '081371573112' },
  { plateNumber: 'BM 1394 JU', driverName: 'Zalmi', driverPhone: '085351138940' },
  { plateNumber: 'BM 1399 JU', driverName: 'Jhon Kuntan', driverPhone: '081364476663' },
  { plateNumber: 'BM 1902 QU', driverName: 'Ari Brewok', driverPhone: '081371663369' },
  { plateNumber: 'BM 1904 QU', driverName: 'Yusnedi', driverPhone: '08127658449' },
  { plateNumber: 'BM 1905 QU', driverName: 'Defrizal', driverPhone: '08127634408' },
  { plateNumber: 'BM 1906 QU', driverName: 'Jaya Adha', driverPhone: '085265456961' },
  { plateNumber: 'BM 1907 QU', driverName: 'Yakub Efendi', driverPhone: '085264015429' },
  { plateNumber: 'BM 1924 QU', driverName: 'Ridwan', driverPhone: '085271387541' },
  { plateNumber: 'BM 1930 QU', driverName: 'Hendrizal', driverPhone: '085194379507' },
  { plateNumber: 'BM 1933 QU', driverName: 'Azwir', driverPhone: '085278131464' },
  { plateNumber: 'BM 1955 QU', driverName: 'Harry Yanson Hutabarat', driverPhone: '085271543750' },
  { plateNumber: 'BM 1956 QU', driverName: 'Sarmi', driverPhone: '081371574888' },
  { plateNumber: 'BM 1957 QU', driverName: 'Nofrizal', driverPhone: '085274237100' },
  { plateNumber: 'BM 1404 JU', driverName: 'Adam Cahyadi', driverPhone: '085763579380' },
];

// Fungsi untuk seeding bulk data armada dan driver
async function bulkSeedFleetData() {
  console.log('🚗 Memulai proses seed data armada dan driver...');
  console.log(`📋 Total data yang akan dibuat: ${fleetData.length} armada dan driver`);
  
  // Mapping untuk menyimpan ID user driver dan fleet untuk assignment nantinya
  const driverMap = new Map<string, string>(); // plateNumber -> userId
  const fleetMap = new Map<string, string>(); // plateNumber -> fleetId
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const item of fleetData) {
    try {
      console.log(`\nMemproses data untuk ${item.plateNumber} - ${item.driverName}...`);
      
      // 1. Buat user driver
      const formattedPhone = formatPhoneNumber(item.driverPhone);
      const username = generateUsername(item.driverName);
      const defaultPassword = 'Driver123!';
      const passwordHash = await hashPassword(defaultPassword);
      
      const user = await prisma.user.create({
        data: {
          name: item.driverName,
          username: username,
          phone: formattedPhone,
          passwordHash: passwordHash || '',
          role: Role.DRIVER,
          isActive: true,
          isVerified: true,
          lastLoginAt: new Date(),
        },
      });
      
      console.log(`✅ User driver dibuat: ${user.id} (${user.name})`);
      driverMap.set(item.plateNumber, user.id);
      
      // 2. Buat driver profile
      const licenseNumber = generateLicenseNumber();
      const idCardNumber = generateIdCardNumber();
      const address = generateRandomAddress();
      const licenseExpiry = new Date('2030-01-01');
      
      const driverProfile = await prisma.driverProfile.create({
        data: {
          userId: user.id,
          licenseNumber: licenseNumber,
          licenseExpiry: licenseExpiry,
          idCardNumber: idCardNumber,
          address: address,
          emergencyContact: formattedPhone, // Gunakan nomor yang sama untuk emergency contact
          isVerified: true,
          rating: 4.5 + (Math.random() * 0.5), // Rating antara 4.5 - 5.0
          totalTrips: Math.floor(Math.random() * 500), // Random trip count
          completedTrips: Math.floor(Math.random() * 450),
          cancelledTrips: Math.floor(Math.random() * 50),
          totalEarnings: BigInt(Math.floor(Math.random() * 10000000)), // Random earnings
          currentLat: 0.5333 + (Math.random() * 0.02), // Sekitar Pekanbaru
          currentLng: 101.45 + (Math.random() * 0.02),
          lastLocationUpdate: new Date(),
          driverStatus: DriverStatus.ACTIVE,
          statusChangedAt: new Date(),
          maxRadius: 10,
          preferredVehicleTypes: [VehicleType.ECONOMY],
        },
      });
      
      console.log(`✅ Driver profile dibuat: ${driverProfile.id}`);
      
      // 3. Buat fleet/kendaraan
      const fleet = await prisma.fleet.create({
        data: {
          type: FleetType.TAXI,
          plateNumber: item.plateNumber,
          model: 'Calya',
          brand: 'Toyota',
          year: 2021,
          color: 'Kuning',
          capacity: 6,
          status: FleetStatus.ACTIVE,
          vehicleType: VehicleType.ECONOMY,
          basePriceMultiplier: 1.0,
          engineNumber: `ENG-${Math.floor(10000 + Math.random() * 90000)}`,
          chassisNumber: `CHS-${Math.floor(10000 + Math.random() * 90000)}`,
          registrationExpiry: new Date('2026-01-01'),
          insuranceExpiry: new Date('2026-01-01'),
        },
      });
      
      console.log(`✅ Fleet dibuat: ${fleet.id} (${fleet.plateNumber})`);
      fleetMap.set(item.plateNumber, fleet.id);
      
      // 4. Buat fleet assignment
      const assignment = await prisma.fleetAssignment.create({
        data: {
          fleetId: fleet.id,
          driverId: user.id,
          isActive: true,
          startedAt: new Date(),
          notes: 'Penugasan awal via bulk seeder',
        },
      });
      
      console.log(`✅ Fleet assignment dibuat: ${assignment.id}`);
      successCount++;
      
    } catch (error: any) {
      console.error(`❌ Error saat memproses ${item.plateNumber}:`, error.message);
      errorCount++;
    }
  }
  
  console.log('\n===== SUMMARY =====');
  console.log(`✅ Berhasil membuat ${successCount} set data`);
  console.log(`❌ Gagal membuat ${errorCount} set data`);
  console.log('====================\n');
  
  if (successCount > 0) {
    console.log('Data armada dan driver berhasil dibuat!');
    console.log('Password default untuk semua driver: Driver123!');
  }
}

async function mainMenu() {
  console.log('\n=== KOPSI Manual Seeder CLI ===\n');

  while (true) {
    const menu = await prompts({
      name: 'choice',
      type: 'select',
      message: 'Pilih entitas untuk dibuat (atau Exit)',
      choices: [
        { title: 'App Config', value: 'appConfig' },
        { title: 'User', value: 'user' },
        { title: 'Driver Profile', value: 'driverProfile' },
        { title: 'Fleet', value: 'fleet' },
        { title: 'Location', value: 'location' },
        { title: 'Order', value: 'order' },
        { title: 'Fleet Assignment', value: 'fleetAssignment' },
        { title: '🚗 Bulk Seed Armada & Driver', value: 'bulkSeedFleetData' },
        { title: 'Exit', value: 'exit' },
      ],
      initial: 1,
    });

    const choice: MenuOption = menu.choice;

    if (!choice || choice === 'exit') {
      console.log('Exiting manual seeder.');
      break;
    }

    try {
      switch (choice) {
        case 'appConfig': await createAppConfigInteractive(); break;
        case 'user': await createUserInteractive(); break;
        case 'driverProfile': await createDriverProfileInteractive(); break;
        case 'fleet': await createFleetInteractive(); break;
        case 'location': await createLocationInteractive(); break;
        case 'order': await createOrderInteractive(); break;
        case 'fleetAssignment': await createFleetAssignmentInteractive(); break;
        case 'bulkSeedFleetData': await bulkSeedFleetData(); break;
        default:
          console.log('Choice not implemented yet:', choice);
      }
    } catch (err) {
      console.error('Error creating entity:', err);
    }
  }
}

async function main() {
  try {
    console.log('KOPSI Database Seeder');
    console.log('===========================================');
    console.log('1. Untuk membuat data satu per satu, gunakan menu interaktif');
    console.log('2. Untuk membuat data armada dan driver secara bulk, pilih opsi "Bulk Seed Armada & Driver"');
    console.log('===========================================');
    
    const action = await prompts({
      type: 'select',
      name: 'type',
      message: 'Pilih jenis seeder:',
      choices: [
        { title: 'Interactive Menu', value: 'interactive' },
        { title: 'Auto Seed Armada & Driver', value: 'auto' },
      ]
    });
    
    if (action.type === 'interactive') {
      await mainMenu();
    } else if (action.type === 'auto') {
      await bulkSeedFleetData();
    } else {
      console.log('Exiting seeder...');
    }
  } catch (err) {
    console.error('Seeder error:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}
export default main;