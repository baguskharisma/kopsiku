// packages/db/src/seed-manual.ts
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
      : '',
      idCardNumber: resp.idCardNumber || null,
      address: resp.address || null,
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
      passengerName: extra.passengerName || null,
      passengerPhone: extra.passengerPhone || null,
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
      baseFare: BigInt(extra.baseFare ?? 0),
      distanceFare: BigInt(extra.distanceFare ?? 0),
      timeFare: BigInt(extra.timeFare ?? 0),
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
        // ==== NEW MENU ITEM ====
        { title: 'Fleet Assignment', value: 'fleetAssignment' },
        // =======================
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
        case 'fleetAssignment': 
          // pastikan fungsi createFleetAssignmentInteractive tersedia di file
          await createFleetAssignmentInteractive();
          break;
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
    await mainMenu();
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
