import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { VehicleType, PaymentMethod, OrderStatus } from '@prisma/client';
import type { CreateOrderRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const orderData: CreateOrderRequest = await request.json();

    // Validate required fields
    const requiredFields = [
      'passengerName',
      'passengerPhone', 
      'pickupAddress',
      'pickupLat',
      'pickupLng',
      'dropoffAddress', 
      'dropoffLat',
      'dropoffLng',
      'requestedVehicleType',
      'baseFare',
      'totalFare',
      'paymentMethod'
    ];

    for (const field of requiredFields) {
      if (!(field in orderData) || orderData[field as keyof CreateOrderRequest] === null || orderData[field as keyof CreateOrderRequest] === undefined) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate enums
    if (!Object.values(VehicleType).includes(orderData.requestedVehicleType)) {
      return NextResponse.json(
        { error: 'Invalid vehicle type' },
        { status: 400 }
      );
    }

    if (!Object.values(PaymentMethod).includes(orderData.paymentMethod)) {
      return NextResponse.json(
        { error: 'Invalid payment method' },
        { status: 400 }
      );
    }

    // Find available fleet for the requested vehicle type
    const availableFleet = await prisma.fleet.findFirst({
      where: {
        vehicleType: orderData.requestedVehicleType,
        status: 'ACTIVE',
        assignments: {
          some: {
            isActive: true,
            driver: {
              driverProfile: {
                driverStatus: 'ACTIVE',
                isVerified: true
              }
            }
          }
        }
      },
      include: {
        assignments: {
          where: {
            isActive: true
          },
          include: {
            driver: {
              include: {
                driverProfile: true
              }
            }
          }
        }
      }
    });

    if (!availableFleet || !availableFleet.assignments[0]) {
      return NextResponse.json(
        { error: 'No available drivers for the requested vehicle type' },
        { status: 404 }
      );
    }

    const driver = availableFleet.assignments[0].driver;

    // Generate unique order number
    const orderNumber = `TXG-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Create order in database
    const order = await prisma.order.create({
      data: {
        orderNumber,
        fleetId: availableFleet.id,
        driverId: driver.id,
        // customerId can be null for guest users
        
        // Passenger details
        passengerName: orderData.passengerName,
        passengerPhone: orderData.passengerPhone,
        specialRequests: orderData.specialRequests,
        
        // Route information
        pickupAddress: orderData.pickupAddress,
        pickupLat: orderData.pickupLat,
        pickupLng: orderData.pickupLng,
        dropoffAddress: orderData.dropoffAddress,
        dropoffLat: orderData.dropoffLat,
        dropoffLng: orderData.dropoffLng,
        
        // Trip details
        requestedVehicleType: orderData.requestedVehicleType,
        distanceMeters: orderData.distanceMeters,
        estimatedDurationMinutes: orderData.estimatedDurationMinutes,

        // Fare calculation (convert from Rupiah to cents)
        baseFare: BigInt(orderData.baseFare),
        distanceFare: BigInt(orderData.distanceFare || 0),
        timeFare: BigInt(orderData.timeFare || 0),
        airportFare: BigInt(orderData.airportFare || 0),
        surgeFare: BigInt(orderData.surgeFare || 0),
        additionalFare: BigInt(orderData.additionalFare || 0),
        discount: BigInt(orderData.discount || 0),
        totalFare: BigInt(orderData.totalFare),
        
        // Payment
        paymentMethod: orderData.paymentMethod,
        paymentStatus: 'PENDING',

        // Initial status
        status: 'PENDING',
      },
      include: {
        fleet: true,
        driver: {
          include: {
            driverProfile: true
          }
        }
      }
    });

    // Create initial status history
    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: 'PENDING',
        toStatus: 'PENDING',
        reason: 'Order created',
        metadata: {
          createdBy: 'system',
          timestamp: new Date().toISOString()
        }
      }
    });

    // Update driver status to busy
    await prisma.driverProfile.update({
      where: {
        userId: driver.id
      },
      data: {
        driverStatus: 'BUSY',
        statusChangedAt: new Date()
      }
    });

    // Create driver status history
    await prisma.driverStatusHistory.create({
      data: {
        driverId: driver.driverProfile!.id,
        fromStatus: 'ACTIVE',
        toStatus: 'BUSY',
        reason: 'Assigned to order',
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber
        }
      }
    });

    // Return order with driver info
    const response = {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      pickupAddress: order.pickupAddress,
      dropoffAddress: order.dropoffAddress,
      totalFare: Number(order.totalFare), // Convert BigInt back to number for JSON
      vehicleType: order.requestedVehicleType,
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        rating: driver.driverProfile?.rating || 0,
        vehicleInfo: {
          brand: order.fleet.brand,
          model: order.fleet.model,
          plateNumber: order.fleet.plateNumber,
          color: order.fleet.color
        }
      },
      estimatedArrival: '3-5 minutes', // This would be calculated based on driver location
      createdAt: order.createdAt
    };

    return NextResponse.json({
      success: true,
      data: response,
      message: 'Order created successfully'
    });

  } catch (error) {
    console.error('Order creation error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create order',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const driverId = searchParams.get('driverId');
    const customerId = searchParams.get('customerId');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    const whereConditions: any = {};

    if (status && Object.values(OrderStatus).includes(status as OrderStatus)) {
      whereConditions.status = status as OrderStatus;
    }

    if (driverId) {
      whereConditions.driverId = driverId;
    }

    if (customerId) {
      whereConditions.customerId = customerId;
    }

    const orders = await prisma.order.findMany({
      where: whereConditions,
      include: {
        fleet: {
          select: {
            brand: true,
            model: true,
            plateNumber: true,
            color: true,
            vehicleType: true
          }
        },
        driver: {
          select: {
            id: true,
            name: true,
            phone: true,
            driverProfile: {
              select: {
                rating: true,
                currentLat: true,
                currentLng: true
              }
            }
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    });

    // Convert BigInt fields to numbers for JSON serialization
    const serializedOrders = orders.map(order => ({
      ...order,
      baseFare: Number(order.baseFare),
      distanceFare: Number(order.distanceFare),
      timeFare: Number(order.timeFare),
      airportFare: Number(order.airportFare),
      surgeFare: Number(order.surgeFare),
      additionalFare: Number(order.additionalFare),
      discount: Number(order.discount),
      totalFare: Number(order.totalFare),
      cancellationFee: Number(order.cancellationFee)
    }));

    const total = await prisma.order.count({
      where: whereConditions
    });

    return NextResponse.json({
      success: true,
      data: {
        orders: serializedOrders,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    });

  } catch (error) {
    console.error('Get orders error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch orders',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}