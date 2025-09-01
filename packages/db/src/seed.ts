// packages/db/src/seed.ts
import { PrismaClient, Role, FleetType, FleetStatus, VehicleType, DriverStatus, LocationCategory, TripType, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

// Utility functions
const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

const generateOrderNumber = (): string => {
  const prefix = 'KOP';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

const generateIdCardNumber = (): string => {
  return faker.string.numeric(16);
};

// Pekanbaru coordinates (around the city)
const PEKANBARU_CENTER = { lat: 0.5333, lng: 101.4500 };
const generatePekanbaruCoordinates = () => {
  const offsetLat = (Math.random() - 0.5) * 0.2; // ~22km radius
  const offsetLng = (Math.random() - 0.5) * 0.2;
  return {
    lat: PEKANBARU_CENTER.lat + offsetLat,
    lng: PEKANBARU_CENTER.lng + offsetLng,
  };
};

// Pekanbaru popular locations
const PEKANBARU_LOCATIONS = [
  { name: 'Mall SKA', address: 'Jl. Soekarno Hatta, Pekanbaru', category: 'POPULAR' as LocationCategory },
  { name: 'Plaza Senapelan', address: 'Jl. Jenderal Sudirman, Pekanbaru', category: 'POPULAR' as LocationCategory },
  { name: 'Bandara Sultan Syarif Kasim II', address: 'Jl. Airport, Pekanbaru', category: 'POPULAR' as LocationCategory },
  { name: 'Universitas Riau', address: 'Jl. Binawidya, Pekanbaru', category: 'POPULAR' as LocationCategory },
  { name: 'RSU Awal Bros', address: 'Jl. Jenderal Sudirman, Pekanbaru', category: 'POPULAR' as LocationCategory },
  { name: 'Masjid Agung An-Nur', address: 'Jl. Diponegoro, Pekanbaru', category: 'POPULAR' as LocationCategory },
  { name: 'Pasar Bawah', address: 'Jl. Jenderal Sudirman, Pekanbaru', category: 'POPULAR' as LocationCategory },
  { name: 'Terminal Mayang Terurai', address: 'Jl. Hangtuah, Pekanbaru', category: 'POPULAR' as LocationCategory },
  { name: 'RSUD Arifin Achmad', address: 'Jl. Diponegoro, Pekanbaru', category: 'POPULAR' as LocationCategory },
  { name: 'Universitas Islam Negeri SUSKA', address: 'Jl. HR. Soebrantas, Pekanbaru', category: 'POPULAR' as LocationCategory },
];

// Real driver and vehicle data
const REAL_FLEET_DATA = [
  { plateNumber: 'BM 1856 QU', driverName: 'Endrizal', phone: '08126850120' },
  { plateNumber: 'BM 1858 QU', driverName: 'Syamsuddin', phone: '081270432500' },
  { plateNumber: 'BM 1860 QU', driverName: 'Safrizal', phone: '085274658457' },
  { plateNumber: 'BM 1862 QU', driverName: 'Mardianto', phone: '088279086838' },
  { plateNumber: 'BM 1863 QU', driverName: 'Syafrizal', phone: '081378334227' },
  { plateNumber: 'BM 1865 QU', driverName: 'Hotler Sibagariang', phone: '081371573112' },
  { plateNumber: 'BM 1394 JU', driverName: 'Zalmi', phone: '085351138940' },
  { plateNumber: 'BM 1399 JU', driverName: 'Jhon Kuntan', phone: '081364476663' },
  { plateNumber: 'BM 1902 QU', driverName: 'Ari Brewok', phone: '081371663369' },
  { plateNumber: 'BM 1904 QU', driverName: 'Yusnedi', phone: '08127658449' },
  { plateNumber: 'BM 1905 QU', driverName: 'Defrizal', phone: '08127634408' },
  { plateNumber: 'BM 1906 QU', driverName: 'Jaya Adha', phone: '085265456961' },
  { plateNumber: 'BM 1907 QU', driverName: 'Yakub Efendi', phone: '085264015429' },
  { plateNumber: 'BM 1924 QU', driverName: 'Ridwan', phone: '085271387541' },
  { plateNumber: 'BM 1930 QU', driverName: 'Hendrizal', phone: '0851-9437-9507' },
  { plateNumber: 'BM 1933 QU', driverName: 'Azwir', phone: '085278131464' },
  { plateNumber: 'BM 1955 QU', driverName: 'Harry Yanson Hutabarat', phone: '085271543750' },
  { plateNumber: 'BM 1956 QU', driverName: 'Sarmi', phone: '081371574988' },
  { plateNumber: 'BM 1957 QU', driverName: 'Nofrizal', phone: '081371680569' },
  { plateNumber: 'BM 1404 JU', driverName: 'Adam Cahyadi', phone: '085763579380' },
];

async function seedAppConfig() {
  console.log('🔧 Seeding app configurations...');
  
  const configs = [
    // Pricing configurations
    { key: 'BASE_FARE_MOTORCYCLE', value: '0', description: 'Base fare for motorcycle in IDR', type: 'number', isPublic: true },
    { key: 'BASE_FARE_ECONOMY', value: '60000', description: 'Base fare for economy car in IDR', type: 'number', isPublic: true },
    { key: 'BASE_FARE_PREMIUM', value: '0', description: 'Base fare for premium car in IDR', type: 'number', isPublic: true },
    { key: 'BASE_FARE_LUXURY', value: '0', description: 'Base fare for luxury car in IDR', type: 'number', isPublic: true },
    
    // Rate configurations
    { key: 'RATE_PER_KM_MOTORCYCLE', value: '2500', description: 'Rate per km for motorcycle in IDR', type: 'number', isPublic: true },
    { key: 'RATE_PER_KM_ECONOMY', value: '6500', description: 'Rate per km for economy car in IDR', type: 'number', isPublic: true },
    { key: 'RATE_PER_KM_PREMIUM', value: '5000', description: 'Rate per km for premium car in IDR', type: 'number', isPublic: true },
    { key: 'RATE_PER_KM_LUXURY', value: '8000', description: 'Rate per km for luxury car in IDR', type: 'number', isPublic: true },
    
    { key: 'RATE_PER_MINUTE', value: '500', description: 'Rate per minute waiting time in IDR', type: 'number', isPublic: true },
    { key: 'AIRPORT_SURCHARGE', value: '5000', description: 'Airport pickup/dropoff surcharge in IDR', type: 'number', isPublic: true },
    
    // Business rules
    { key: 'DRIVER_COMMISSION_RATE', value: '0.8', description: 'Driver commission rate (80%)', type: 'number', isPublic: false },
    { key: 'PLATFORM_FEE_RATE', value: '0.2', description: 'Platform fee rate (20%)', type: 'number', isPublic: false },
    { key: 'CANCELLATION_FEE', value: '5000', description: 'Cancellation fee in IDR', type: 'number', isPublic: true },
    { key: 'FREE_CANCELLATION_TIME', value: '3', description: 'Free cancellation time in minutes', type: 'number', isPublic: true },
    
    // Operational settings
    { key: 'MAX_DRIVER_SEARCH_RADIUS', value: '10', description: 'Maximum driver search radius in km', type: 'number', isPublic: false },
    { key: 'ORDER_TIMEOUT_MINUTES', value: '15', description: 'Order timeout in minutes', type: 'number', isPublic: false },
    { key: 'DRIVER_RESPONSE_TIMEOUT', value: '30', description: 'Driver response timeout in seconds', type: 'number', isPublic: false },
    
    // App settings
    { key: 'APP_NAME', value: 'KOPSI Transport', description: 'Application name', type: 'string', isPublic: true },
    { key: 'APP_VERSION', value: '1.0.0', description: 'Application version', type: 'string', isPublic: true },
    { key: 'SUPPORT_PHONE', value: '+62761123456', description: 'Customer support phone number', type: 'string', isPublic: true },
    { key: 'SUPPORT_EMAIL', value: 'support@kopsi.id', description: 'Customer support email', type: 'string', isPublic: true },
    
    // Feature flags
    { key: 'ENABLE_SCHEDULED_RIDES', value: 'true', description: 'Enable scheduled ride feature', type: 'boolean', isPublic: true },
    { key: 'ENABLE_CASH_PAYMENT', value: 'true', description: 'Enable cash payment option', type: 'boolean', isPublic: true },
    { key: 'ENABLE_SURGE_PRICING', value: 'true', description: 'Enable surge pricing', type: 'boolean', isPublic: false },
    { key: 'MAINTENANCE_MODE', value: 'false', description: 'Maintenance mode flag', type: 'boolean', isPublic: true },
  ];

  for (const config of configs) {
    await prisma.appConfig.upsert({
      where: { key: config.key },
      update: config,
      create: {
        ...config,
        updatedBy: 'system',
      },
    });
  }
  
  console.log(`✅ Created ${configs.length} app configurations`);
}

async function seedUsers() {
  console.log('👥 Seeding users...');

  // Create Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      name: 'Super Administrator',
      username: 'superadmin',
      email: 'contact.hiveid@gmail.com',
      phone: '089515828036',
      passwordHash: await hashPassword('Hive123::'),
      role: Role.SUPER_ADMIN,
      isActive: true,
      isVerified: true,
      lastLoginAt: new Date(),
    },
  });

  // Create Admins
  const admin = await prisma.user.create({
    data: {
      name: 'Administrator',
      username: 'operatorssq',
      email: 'operator@kopsiku.com',
      phone: '081372175558',
      passwordHash: await hashPassword('KopsikuPekanbaru@1234::'),
      role: Role.ADMIN,
      isActive: true,
      isVerified: true,
      lastLoginAt: new Date(),
    },
  });
  // const admins = [];
  // for (let i = 1; i <= 3; i++) {
  //   const admin = await prisma.user.create({
  //     data: {
  //       name: `Admin ${i}`,
  //       username: `admin${i}`,
  //       email: `admin${i}@kopsi.id`,
  //       phone: `+627610000000${i + 1}`,
  //       passwordHash: await hashPassword('Admin123!'),
  //       role: Role.ADMIN,
  //       isActive: true,
  //       isVerified: true,
  //       lastLoginAt: faker.date.recent({ days: 7 }),
  //     },
  //   });
  //   admins.push(admin);
  // }

  // Create Real Drivers based on REAL_FLEET_DATA
  const drivers: any[] = [];
  for (const driverData of REAL_FLEET_DATA) {
    const driver = await prisma.user.create({
      data: {
        name: driverData.driverName,
        username: `driver${drivers.length + 1}`,
        email: `${driverData.driverName.toLowerCase().replace(/\s+/g, '')}@kopsi.id`,
        phone: driverData.phone || `+62812${faker.string.numeric(8)}`,
        passwordHash: await hashPassword('Driver123!'),
        role: Role.DRIVER,
        isActive: true,
        isVerified: true, // All real drivers are verified
        lastLoginAt: faker.date.recent({ days: 1 }),
      },
    });
    drivers.push(driver);
  }

  // Create Customers
  const customers = [];
  for (let i = 1; i <= 200; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const customer = await prisma.user.create({
      data: {
        name: `${firstName} ${lastName}`,
        email: i <= 150 ? `customer${i}@example.com` : null, // Not all customers have email
        phone: `+62813${faker.string.numeric(8)}`,
        passwordHash: await hashPassword('Customer123!'),
        role: Role.CUSTOMER,
        isActive: true,
        isVerified: faker.datatype.boolean(0.8), // 80% verified
        lastLoginAt: faker.date.recent({ days: 30 }),
      },
    });
    customers.push(customer);
  }

  console.log(`✅ Created 1 super admin, 1 admin, ${drivers.length} drivers, ${customers.length} customers`);
  
  return { superAdmin, admin, drivers, customers };
}

async function seedDriverProfiles(drivers: any[]) {
  console.log('🚗 Seeding driver profiles...');

  const driverProfiles = [];
  
  for (let i = 0; i < drivers.length; i++) {
    const driver = drivers[i];
    const coordinates = generatePekanbaruCoordinates();
    
    const profile = await prisma.driverProfile.create({
      data: {
        userId: driver.id,
        licenseNumber: `SIM-${faker.string.numeric(10)}`,
        licenseExpiry: faker.date.future({ years: 2 }),
        idCardNumber: generateIdCardNumber(),
        address: `${faker.location.streetAddress()}, Pekanbaru, Riau`,
        emergencyContact: `+62811${faker.string.numeric(8)}`,
        bankAccount: faker.finance.accountNumber(10),
        bankName: faker.helpers.arrayElement(['BCA', 'Mandiri', 'BRI', 'BNI', 'CIMB Niaga']),
        
        // All real drivers are verified
        isVerified: true,
        verifiedAt: faker.date.past({ years: 1 }),
        verifiedBy: 'admin1',
        verificationNotes: 'Real driver verified and approved',
        
        // Performance metrics (realistic data)
        rating: faker.number.float({ min: 4.0, max: 5.0, multipleOf: 0.1 }),
        totalTrips: faker.number.int({ min: 100, max: 1000 }),
        completedTrips: Math.floor(faker.number.int({ min: 100, max: 1000 }) * 0.95),
        cancelledTrips: Math.floor(faker.number.int({ min: 100, max: 1000 }) * 0.05),
        totalEarnings: BigInt(faker.number.int({ min: 10000000, max: 50000000 })), // 10M - 50M IDR
        
        // Location
        currentLat: coordinates.lat,
        currentLng: coordinates.lng,
        lastLocationUpdate: faker.date.recent({ days: 1 }),
        
        // Status
        driverStatus: faker.helpers.arrayElement([DriverStatus.ACTIVE, DriverStatus.OFFLINE, DriverStatus.BUSY]),
        statusChangedAt: faker.date.recent({ days: 1 }),
        
        // Preferences
        maxRadius: faker.number.float({ min: 5, max: 15, multipleOf: 0.5 }),
        preferredVehicleTypes: [VehicleType.ECONOMY], // All use economy vehicles
      },
    });
    
    driverProfiles.push(profile);
  }

  console.log(`✅ Created ${driverProfiles.length} driver profiles`);
  return driverProfiles;
}

async function seedFleets() {
  console.log('🚙 Seeding fleets...');

  const fleets = [];
  
  // Create fleets based on real data
  for (const fleetData of REAL_FLEET_DATA) {
    const fleet = await prisma.fleet.create({
      data: {
        type: FleetType.CAR_SMALL,
        plateNumber: fleetData.plateNumber,
        model: 'Calya',
        brand: 'Toyota',
        year: faker.number.int({ min: 2018, max: 2024 }),
        color: faker.helpers.arrayElement(['Putih', 'Silver', 'Hitam', 'Merah', 'Abu-abu']),
        capacity: 6,
        status: FleetStatus.ACTIVE,
        vehicleType: VehicleType.ECONOMY,
        
        // Vehicle specifications
        engineNumber: faker.vehicle.vin(),
        chassisNumber: faker.vehicle.vin(),
        registrationExpiry: faker.date.future({ years: 1 }),
        insuranceExpiry: faker.date.future({ years: 1 }),
        lastMaintenanceAt: faker.date.past({ years: 0.25 }), // ~3 months
        nextMaintenanceAt: faker.date.future({ years: 0.25 }), // ~3 months
        
        basePriceMultiplier: 1.2, // Economy car multiplier
      },
    });
    fleets.push(fleet);
  }

  console.log(`✅ Created ${fleets.length} fleet vehicles (all Toyota Calya Economy)`);
  return fleets;
}

async function seedFleetAssignments(drivers: any[], fleets: any[]) {
  console.log('🔗 Seeding fleet assignments...');

  const assignments = [];
  
  // Assign each fleet to corresponding driver (one-to-one mapping)
  for (let i = 0; i < Math.min(drivers.length, fleets.length); i++) {
    const driver = drivers[i];
    const fleet = fleets[i];
    
    const assignment = await prisma.fleetAssignment.create({
      data: {
        fleetId: fleet.id,
        driverId: driver.id,
        isActive: true,
        startedAt: faker.date.past({ years: 1 }),
        notes: `${fleet.plateNumber} assigned to driver ${driver.name}`,
      },
    });
    
    assignments.push(assignment);
  }

  console.log(`✅ Created ${assignments.length} fleet assignments`);
  return assignments;
}

async function seedPricingRules() {
  console.log('💰 Seeding pricing rules...');

  const pricingRules = [
    // Economy car pricing (main rule since all vehicles are economy)
    {
      name: 'Economy Car Standard Rate',
      vehicleType: VehicleType.ECONOMY,
      baseFare: BigInt(60000),
      perKmRate: BigInt(6500),
      perMinuteRate: BigInt(0),
      minimumFare: BigInt(0),
      surgeMultiplier: 0,
      isActive: true,
      validFrom: new Date('2024-01-01'),
      validTo: null,
    },
    
    // Peak hour surge pricing
    {
      name: 'Peak Hour Surge - Economy',
      vehicleType: VehicleType.ECONOMY,
      baseFare: BigInt(60000),
      perKmRate: BigInt(6500),
      perMinuteRate: BigInt(0),
      minimumFare: BigInt(0),
      surgeMultiplier: 0,
      isActive: false, // Can be activated during peak hours
      validFrom: new Date('2024-01-01'),
      validTo: null,
      applicableAreas: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "Pekanbaru City Center" },
            geometry: {
              type: "Polygon",
              coordinates: [[[101.4200, 0.5100], [101.4800, 0.5100], [101.4800, 0.5600], [101.4200, 0.5600], [101.4200, 0.5100]]]
            }
          }
        ]
      },
    },
    
    // Airport surcharge rule
    {
      name: 'Airport Surcharge - Economy',
      vehicleType: VehicleType.ECONOMY,
      baseFare: BigInt(65000), // Base + Airport surcharge
      perKmRate: BigInt(6500),
      perMinuteRate: BigInt(0),
      minimumFare: BigInt(0),
      surgeMultiplier: 0,
      isActive: true,
      validFrom: new Date('2024-01-01'),
      validTo: null,
      applicableAreas: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "Sultan Syarif Kasim II Airport Area" },
            geometry: {
              type: "Polygon",
              coordinates: [[[101.4350, 0.4630], [101.4650, 0.4630], [101.4650, 0.4830], [101.4350, 0.4830], [101.4350, 0.4630]]]
            }
          }
        ]
      },
    },
  ];

  const createdRules = [];
  for (const rule of pricingRules) {
    const pricingRule = await prisma.pricingRule.create({
      data: rule,
    });
    createdRules.push(pricingRule);
  }

  console.log(`✅ Created ${createdRules.length} pricing rules`);
  return createdRules;
}

async function seedLocations() {
  console.log('📍 Seeding locations...');

  const locations = [];
  
  // Create popular locations in Pekanbaru
  for (const locationData of PEKANBARU_LOCATIONS) {
    const coordinates = generatePekanbaruCoordinates();
    
    const location = await prisma.location.create({
      data: {
        name: locationData.name,
        address: locationData.address,
        lat: coordinates.lat,
        lng: coordinates.lng,
        category: locationData.category,
        icon: 'map-pin',
        description: `Popular location in Pekanbaru: ${locationData.name}`,
        isActive: true,
        searchCount: faker.number.int({ min: 100, max: 5000 }),
      },
    });
    locations.push(location);
  }
  
  // Add more random locations
  for (let i = 0; i < 40; i++) {
    const coordinates = generatePekanbaruCoordinates();
    const location = await prisma.location.create({
      data: {
        name: faker.company.name(),
        address: `${faker.location.streetAddress()}, Pekanbaru, Riau`,
        lat: coordinates.lat,
        lng: coordinates.lng,
        category: faker.helpers.arrayElement([LocationCategory.POPULAR, LocationCategory.RECENT]),
        icon: 'building',
        description: faker.lorem.sentence(),
        isActive: true,
        searchCount: faker.number.int({ min: 10, max: 1000 }),
      },
    });
    locations.push(location);
  }

  console.log(`✅ Created ${locations.length} locations`);
  return locations;
}

async function seedUserLocations(customers: any[], locations: any[]) {
  console.log('🏠 Seeding user locations...');

  const userLocations = [];
  
  // Assign favorite locations to some customers
  for (let i = 0; i < Math.min(customers.length * 0.3, 60); i++) {
    const customer = customers[i];
    const favoriteLocations = faker.helpers.arrayElements(locations, { min: 1, max: 3 });
    
    for (const location of favoriteLocations) {
      const category = faker.helpers.arrayElement([
        LocationCategory.HOME, 
        LocationCategory.WORK, 
        LocationCategory.FAVORITE
      ]);
      
      const userLocation = await prisma.userLocation.create({
        data: {
          userId: customer.id,
          locationId: location.id,
          category,
          alias: category === LocationCategory.HOME ? 'Home' : 
                 category === LocationCategory.WORK ? 'Office' : 
                 location.name,
          accessCount: faker.number.int({ min: 1, max: 50 }),
        },
      });
      userLocations.push(userLocation);
    }
  }

  console.log(`✅ Created ${userLocations.length} user locations`);
  return userLocations;
}

async function seedOrders(customers: any[], drivers: any[], fleets: any[], locations: any[]) {
  console.log('📋 Seeding orders...');

  const orders = [];
  
  for (let i = 0; i < 500; i++) {
    const customer = faker.helpers.arrayElement(customers);
    const driver = faker.helpers.arrayElement(drivers);
    const fleet = faker.helpers.arrayElement(fleets);
    
    const pickupLocation = generatePekanbaruCoordinates();
    const dropoffLocation = generatePekanbaruCoordinates();
    
    // Calculate distance (simplified)
    const distanceKm = faker.number.float({ min: 1, max: 25, multipleOf: 0.1 });
    const distanceMeters = Math.floor(distanceKm * 1000);
    
    // All vehicles are economy type
    const vehicleType = VehicleType.ECONOMY;
    
    // Calculate fare based on economy vehicle
    const baseFare = BigInt(60000);
    const perKmRate = BigInt(6500);
    const distanceFare = BigInt(Math.floor(distanceKm * Number(perKmRate)));
    const timeFare = BigInt(faker.number.int({ min: 2000, max: 10000 }));
    const airportFare = faker.datatype.boolean(0.1) ? BigInt(5000) : BigInt(0);
    const totalFare = baseFare + distanceFare + timeFare + airportFare;
    
    // Determine order status based on creation time
    const createdAt = faker.date.past({ years: 1 });
    const isRecent = createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
    
    let status: OrderStatus;
    if (isRecent && faker.datatype.boolean(0.3)) {
      status = faker.helpers.arrayElement([
        OrderStatus.PENDING,
        OrderStatus.DRIVER_ASSIGNED,
        OrderStatus.DRIVER_ACCEPTED,
        OrderStatus.IN_PROGRESS
      ]);
    } else {
      status = faker.helpers.arrayElement([
        OrderStatus.COMPLETED,
        OrderStatus.CANCELLED_BY_CUSTOMER,
        OrderStatus.CANCELLED_BY_DRIVER
      ]);
    }
    
    const order = await prisma.order.create({
      data: {
        customerId: customer.id,
        driverId: driver.id,
        fleetId: fleet.id,
        
        orderNumber: generateOrderNumber(),
        tripType: faker.helpers.arrayElement([TripType.INSTANT, TripType.SCHEDULED]),
        scheduledAt: faker.datatype.boolean(0.1) ? faker.date.future() : null,
        
        passengerName: customer.name,
        passengerPhone: customer.phone,
        specialRequests: faker.datatype.boolean(0.2) ? faker.lorem.sentence() : null,
        
        pickupAddress: `${faker.location.streetAddress()}, Pekanbaru`,
        pickupLat: pickupLocation.lat,
        pickupLng: pickupLocation.lng,
        dropoffAddress: `${faker.location.streetAddress()}, Pekanbaru`,
        dropoffLat: dropoffLocation.lat,
        dropoffLng: dropoffLocation.lng,
        
        requestedVehicleType: vehicleType,
        distanceMeters,
        estimatedDurationMinutes: Math.ceil(distanceKm * 3), // 3 minutes per km estimate
        actualDurationMinutes: status === OrderStatus.COMPLETED ? 
          Math.ceil(distanceKm * faker.number.float({ min: 2.5, max: 4.5 })) : null,

        // Fare breakdown
        baseFare,
        distanceFare,
        timeFare,
        airportFare,
        surgeFare: BigInt(0),
        additionalFare: BigInt(0),
        discount: faker.datatype.boolean(0.1) ? BigInt(faker.number.int({ min: 5000, max: 20000 })) : BigInt(0),
        totalFare,
        
        paymentMethod: faker.helpers.arrayElement([
          PaymentMethod.CASH,
          PaymentMethod.QRIS,
          PaymentMethod.EWALLET,
          PaymentMethod.BANK_TRANSFER
        ]),
        paymentStatus: status === OrderStatus.COMPLETED ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
        
        status,
        
        // Timestamps based on status
        driverAssignedAt: faker.date.between({ from: createdAt, to: new Date(createdAt.getTime() + 5 * 60 * 1000) }),
        driverAcceptedAt: status !== OrderStatus.PENDING ? faker.date.between({ from: createdAt, to: new Date(createdAt.getTime() + 10 * 60 * 1000) }) : null,
        driverArrivedAt: status === OrderStatus.COMPLETED ? faker.date.between({ from: createdAt, to: new Date(createdAt.getTime() + 15 * 60 * 1000) }) : null,
        tripStartedAt: status === OrderStatus.COMPLETED ? faker.date.between({ from: createdAt, to: new Date(createdAt.getTime() + 20 * 60 * 1000) }) : null,
        tripCompletedAt: status === OrderStatus.COMPLETED ? faker.date.between({ from: createdAt, to: new Date(createdAt.getTime() + 60 * 60 * 1000) }) : null,
        
        // Cancellation info
        cancelledAt: status.includes('CANCELLED') ? faker.date.between({ from: createdAt, to: new Date(createdAt.getTime() + 30 * 60 * 1000) }) : null,
        cancelledReason: status.includes('CANCELLED') ? faker.helpers.arrayElement([
          'Customer changed mind',
          'Driver not available',
          'Wrong pickup location',
          'Traffic too heavy',
          'Customer not responding'
        ]) : null,
        cancellationFee: status.includes('CANCELLED') && faker.datatype.boolean(0.3) ? BigInt(5000) : BigInt(0),
        
        idempotencyKey: faker.string.uuid(),
        createdAt,
      },
    });
    
    orders.push(order);
  }

  console.log(`✅ Created ${orders.length} orders`);
  return orders;
}

async function seedOrderStatusHistory(orders: any[]) {
  console.log('📈 Seeding order status history...');

  const statusHistories = [];
  
  for (const order of orders) {
    // Create status progression for completed orders
    if (order.status === OrderStatus.COMPLETED) {
      const statuses = [
        { from: null, to: OrderStatus.PENDING },
        { from: OrderStatus.PENDING, to: OrderStatus.DRIVER_ASSIGNED },
        { from: OrderStatus.DRIVER_ASSIGNED, to: OrderStatus.DRIVER_ACCEPTED },
        { from: OrderStatus.DRIVER_ACCEPTED, to: OrderStatus.DRIVER_ARRIVING },
        { from: OrderStatus.DRIVER_ARRIVING, to: OrderStatus.IN_PROGRESS },
        { from: OrderStatus.IN_PROGRESS, to: OrderStatus.COMPLETED },
      ];
      
      for (let i = 0; i < statuses.length; i++) {
        const statusChange = statuses[i];
        if (!statusChange) continue; // Skip if undefined
        
        const timestamp = new Date(order.createdAt.getTime() + i * 10 * 60 * 1000); // 10 minutes apart
        
        const history = await prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: statusChange.from || OrderStatus.PENDING,
            toStatus: statusChange.to,
            reason: i === 0 ? 'Order created' : 
                   i === 1 ? 'Driver found and assigned' :
                   i === 2 ? 'Driver accepted the order' :
                   i === 3 ? 'Driver is on the way' :
                   i === 4 ? 'Trip started' : 'Trip completed successfully',
            metadata: {
              automated: i < 2,
              driverId: order.driverId,
              location: i >= 3 ? { lat: faker.location.latitude(), lng: faker.location.longitude() } : null,
            },
            changedBy: i === 0 ? 'system' : order.driverId,
            createdAt: timestamp,
          },
        });
        statusHistories.push(history);
      }
    } 
    // Create simpler history for other statuses
    else {
      const history = await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: OrderStatus.PENDING,
          toStatus: order.status,
          reason: order.status.includes('CANCELLED') ? order.cancelledReason || 'Order cancelled' : 'Status updated',
          metadata: {
            automated: false,
            reason: order.cancelledReason,
          },
          changedBy: order.status === OrderStatus.CANCELLED_BY_CUSTOMER ? order.customerId : 
                    order.status === OrderStatus.CANCELLED_BY_DRIVER ? order.driverId : 'system',
          createdAt: order.cancelledAt || new Date(order.createdAt.getTime() + 5 * 60 * 1000),
        },
      });
      statusHistories.push(history);
    }
  }

  console.log(`✅ Created ${statusHistories.length} order status history records`);
  return statusHistories;
}

async function seedPayments(orders: any[]) {
  console.log('💳 Seeding payments...');

  const payments = [];
  const completedOrders = orders.filter(order => order.status === OrderStatus.COMPLETED);
  
  for (const order of completedOrders) {
    const platformFee = BigInt(Math.floor(Number(order.totalFare) * 0.2)); // 20% platform fee
    const driverEarning = order.totalFare - platformFee;
    
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: order.paymentMethod,
        provider: order.paymentMethod === PaymentMethod.CASH ? 'MANUAL' : 
                 order.paymentMethod === PaymentMethod.QRIS ? 'QRIS_PROVIDER' :
                 order.paymentMethod === PaymentMethod.EWALLET ? 'EWALLET_PROVIDER' :
                 'BANK_TRANSFER',
        providerId: order.paymentMethod !== PaymentMethod.CASH ? faker.string.alphanumeric(20) : null,
        providerOrderId: order.paymentMethod !== PaymentMethod.CASH ? faker.string.alphanumeric(15) : null,
        
        amount: order.totalFare,
        platformFee,
        driverEarning,
        
        status: PaymentStatus.COMPLETED,
        paidAt: order.tripCompletedAt,
        
        rawResponse: order.paymentMethod !== PaymentMethod.CASH ? {
          transaction_id: faker.string.alphanumeric(32),
          provider_response: 'SUCCESS',
          payment_type: order.paymentMethod,
          gross_amount: Number(order.totalFare),
        } : undefined,
      },
    });
    
    payments.push(payment);
  }

  console.log(`✅ Created ${payments.length} payments`);
  return payments;
}

async function seedRatings(orders: any[]) {
  console.log('⭐ Seeding ratings...');

  const ratings = [];
  const completedOrders = orders.filter(order => 
    order.status === OrderStatus.COMPLETED && 
    order.driverId && 
    faker.datatype.boolean(0.7) // 70% of completed orders have ratings
  );
  
  const ratingTags = [
    'clean_vehicle', 'polite_driver', 'fast_service', 'safe_driving', 
    'punctual', 'friendly', 'professional', 'good_route', 'comfortable_ride',
    'air_conditioning', 'music_good', 'vehicle_maintained'
  ];
  
  for (const order of completedOrders) {
    const ratingValue = faker.number.int({ min: 1, max: 5 });
    const selectedTags = ratingValue >= 4 ? 
      faker.helpers.arrayElements(ratingTags.filter(tag => !tag.includes('bad')), { min: 1, max: 3 }) :
      [];
    
    const rating = await prisma.rating.create({
      data: {
        orderId: order.id,
        ratedById: order.customerId,
        ratedUserId: order.driverId,
        rating: ratingValue,
        comment: ratingValue >= 4 ? 
          faker.helpers.arrayElement([
            'Great service!', 
            'Driver was very professional',
            'Clean vehicle and safe driving',
            'Arrived on time, good service',
            'Recommended driver!'
          ]) :
          ratingValue === 3 ?
          faker.helpers.arrayElement([
            'Average service',
            'Could be better',
            'Okay experience'
          ]) :
          faker.helpers.arrayElement([
            'Service needs improvement',
            'Driver was late',
            'Vehicle not clean'
          ]),
        tags: selectedTags,
      },
    });
    
    ratings.push(rating);
  }

  console.log(`✅ Created ${ratings.length} ratings`);
  return ratings;
}

async function seedDriverStatusHistory(driverProfiles: any[]) {
  console.log('📊 Seeding driver status history...');

  const statusHistories = [];
  
  for (const profile of driverProfiles) {
    // Create verification history for all real drivers (all are verified)
    const verificationHistory = await prisma.driverStatusHistory.create({
      data: {
        driverId: profile.id,
        fromStatus: DriverStatus.PENDING_VERIFICATION,
        toStatus: DriverStatus.ACTIVE,
        reason: 'Real driver verification completed successfully',
        metadata: {
          verified_by: 'admin1',
          verification_date: profile.verifiedAt,
          documents_checked: ['license', 'id_card', 'vehicle_registration'],
          real_driver: true,
        },
        changedBy: 'admin1',
        createdAt: profile.verifiedAt,
      },
    });
    statusHistories.push(verificationHistory);
    
    // Add some random status changes for active drivers
    if (faker.datatype.boolean(0.3)) {
      const statusChange = await prisma.driverStatusHistory.create({
        data: {
          driverId: profile.id,
          fromStatus: DriverStatus.ACTIVE,
          toStatus: faker.helpers.arrayElement([DriverStatus.OFFLINE, DriverStatus.MAINTENANCE_MODE]),
          reason: faker.helpers.arrayElement([
            'Driver went offline',
            'Vehicle maintenance required',
            'Driver break time',
            'End of shift'
          ]),
          metadata: {
            automatic: false,
            location: { lat: profile.currentLat, lng: profile.currentLng },
          },
          changedBy: profile.userId,
          createdAt: faker.date.recent({ days: 30 }),
        },
      });
      statusHistories.push(statusChange);
    }
  }

  console.log(`✅ Created ${statusHistories.length} driver status history records`);
  return statusHistories;
}

async function seedOtps(users: any[]) {
  console.log('📱 Seeding OTPs...');

  const otps = [];
  
  // Create some recent OTPs for testing
  for (let i = 0; i < 20; i++) {
    const user = faker.helpers.arrayElement(users);
    const purpose = faker.helpers.arrayElement(['login', 'register', 'reset', 'verify_phone']);
    
    const otp = await prisma.otp.create({
      data: {
        phone: user.phone,
        codeHash: await hashPassword('123456'), // In reality, this would be a hashed OTP code
        purpose,
        attempts: faker.number.int({ min: 0, max: 2 }),
        maxAttempts: 3,
        isUsed: faker.datatype.boolean(0.7),
        userId: user.id,
        expiresAt: faker.date.future({ years: 0.001 }),
      },
    });
    
    otps.push(otp);
  }

  console.log(`✅ Created ${otps.length} OTPs`);
  return otps;
}

async function seedRefreshTokens(users: any[]) {
  console.log('🔑 Seeding refresh tokens...');

  const refreshTokens = [];
  
  // Create refresh tokens for active users
  const activeUsers = users.filter(user => user.lastLoginAt && user.isActive);
  
  for (const user of activeUsers.slice(0, 100)) { // Limit to 100 for performance
    const token = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: await hashPassword(faker.string.alphanumeric(64)),
        deviceId: faker.string.uuid(),
        userAgent: faker.internet.userAgent(),
        ipAddress: faker.internet.ip(),
        isRevoked: faker.datatype.boolean(0.1), // 10% revoked
        revokedAt: faker.datatype.boolean(0.1) ? faker.date.recent({ days: 7 }) : null,
        lastUsedAt: faker.date.recent({ days: 1 }),
        expiresAt: faker.date.future({ years: 0.08 }),
      },
    });
    
    refreshTokens.push(token);
  }

  console.log(`✅ Created ${refreshTokens.length} refresh tokens`);
  return refreshTokens;
}

async function seedAuditLogs(users: any[], orders: any[]) {
  console.log('📋 Seeding audit logs...');

  const auditLogs = [];
  const adminUsers = users.filter(user => user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN);
  
  // Create audit logs for various actions
  for (let i = 0; i < 200; i++) {
    const user = faker.helpers.arrayElement([...adminUsers, null]); // Some system actions
    const action = faker.helpers.arrayElement(['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'STATUS_CHANGE']);
    const resource = faker.helpers.arrayElement(['users', 'orders', 'fleets', 'payments', 'drivers']);
    
    const auditLog = await prisma.auditLog.create({
      data: {
        action,
        resource,
        resourceId: resource === 'orders' ? faker.helpers.arrayElement(orders).id : faker.string.uuid(),
        oldValues: action === 'UPDATE' ? {
          status: 'PENDING',
          updatedAt: faker.date.past().toISOString(),
        } : undefined,
        newValues: action !== 'DELETE' ? {
          status: 'COMPLETED',
          updatedAt: new Date().toISOString(),
        } : undefined,
        ipAddress: faker.internet.ip(),
        userAgent: faker.internet.userAgent(),
        userId: user?.id || null,
        createdAt: faker.date.past({ years: 0.5 }),
      },
    });
    
    auditLogs.push(auditLog);
  }

  console.log(`✅ Created ${auditLogs.length} audit logs`);
  return auditLogs;
}

async function main() {
  console.log('🌱 Starting KOPSI Transport database seeding...\n');

  try {
    // Clean existing data (optional - be careful in production!)
    console.log('🧹 Cleaning existing data...');
    await prisma.auditLog.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.otp.deleteMany();
    await prisma.driverStatusHistory.deleteMany();
    await prisma.rating.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.orderStatusHistory.deleteMany();
    await prisma.order.deleteMany();
    await prisma.userLocation.deleteMany();
    await prisma.location.deleteMany();
    await prisma.pricingRule.deleteMany();
    await prisma.fleetAssignment.deleteMany();
    await prisma.fleet.deleteMany();
    await prisma.driverProfile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.appConfig.deleteMany();
    console.log('✅ Cleaned existing data\n');

    // Seed in order of dependencies
    await seedAppConfig();
    
    const { superAdmin, admin, drivers, customers } = await seedUsers();
    const allUsers = [superAdmin, admin, ...drivers, ...customers];
    
    const driverProfiles = await seedDriverProfiles(drivers);
    const fleets = await seedFleets();
    const fleetAssignments = await seedFleetAssignments(drivers, fleets);
    const pricingRules = await seedPricingRules();
    const locations = await seedLocations();
    const userLocations = await seedUserLocations(customers, locations);
    const orders = await seedOrders(customers, drivers, fleets, locations);
    const orderStatusHistory = await seedOrderStatusHistory(orders);
    const payments = await seedPayments(orders);
    const ratings = await seedRatings(orders);
    const driverStatusHistory = await seedDriverStatusHistory(driverProfiles);
    const otps = await seedOtps(allUsers);
    const refreshTokens = await seedRefreshTokens(allUsers);
    const auditLogs = await seedAuditLogs(allUsers, orders);

    console.log('\n🎉 KOPSI Transport database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - App Configurations: ${await prisma.appConfig.count()}`);
    console.log(`   - Users: ${await prisma.user.count()}`);
    console.log(`   - Driver Profiles: ${await prisma.driverProfile.count()}`);
    console.log(`   - Fleets: ${await prisma.fleet.count()} (All Toyota Calya Economy)`);
    console.log(`   - Fleet Assignments: ${await prisma.fleetAssignment.count()}`);
    console.log(`   - Pricing Rules: ${await prisma.pricingRule.count()}`);
    console.log(`   - Locations: ${await prisma.location.count()}`);
    console.log(`   - User Locations: ${await prisma.userLocation.count()}`);
    console.log(`   - Orders: ${await prisma.order.count()}`);
    console.log(`   - Order Status History: ${await prisma.orderStatusHistory.count()}`);
    console.log(`   - Payments: ${await prisma.payment.count()}`);
    console.log(`   - Ratings: ${await prisma.rating.count()}`);
    console.log(`   - Driver Status History: ${await prisma.driverStatusHistory.count()}`);
    console.log(`   - OTPs: ${await prisma.otp.count()}`);
    console.log(`   - Refresh Tokens: ${await prisma.refreshToken.count()}`);
    console.log(`   - Audit Logs: ${await prisma.auditLog.count()}`);

    console.log('\n🚗 Real Fleet Data:');
    console.log('   - 20 Toyota Calya Economy vehicles with real drivers');
    console.log('   - All drivers verified and active');
    console.log('   - Real plate numbers and phone numbers included');

    console.log('\n🔐 Test Credentials:');
    console.log('   Super Admin: superadmin@kopsi.id / SuperAdmin123!');
    console.log('   Admin: admin1@kopsi.id / Admin123!');
    console.log('   Real Driver Example: endrizal@kopsi.id / Driver123!');
    console.log('   Customer: customer1@example.com / Customer123!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the seeder
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
}

export default main;