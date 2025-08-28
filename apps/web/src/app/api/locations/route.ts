import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LocationCategory } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const whereConditions: any = {
      isActive: true
    };

    // Filter by category if provided
    if (category && Object.values(LocationCategory).includes(category as LocationCategory)) {
      whereConditions.category = category as LocationCategory;
    }

    // Search functionality
    if (search && search.trim().length > 0) {
      whereConditions.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          address: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ];
    }

    const locations = await prisma.location.findMany({
      where: whereConditions,
      orderBy: [
        {
          searchCount: 'desc' // Popular locations first
        },
        {
          name: 'asc'
        }
      ],
      take: limit,
      skip: offset
    });

    const total = await prisma.location.count({
      where: whereConditions
    });

    return NextResponse.json({
      success: true,
      data: locations,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    console.error('Get locations error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch locations',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const locationData = await request.json();

    // Validate required fields
    const requiredFields = ['name', 'address', 'lat', 'lng'];
    for (const field of requiredFields) {
      if (!(field in locationData) || locationData[field] === null || locationData[field] === undefined) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate coordinates
    if (typeof locationData.lat !== 'number' || typeof locationData.lng !== 'number') {
      return NextResponse.json(
        { error: 'Latitude and longitude must be numbers' },
        { status: 400 }
      );
    }

    // Validate latitude and longitude ranges
    if (locationData.lat < -90 || locationData.lat > 90) {
      return NextResponse.json(
        { error: 'Latitude must be between -90 and 90' },
        { status: 400 }
      );
    }

    if (locationData.lng < -180 || locationData.lng > 180) {
      return NextResponse.json(
        { error: 'Longitude must be between -180 and 180' },
        { status: 400 }
      );
    }

    // Validate category if provided
    if (locationData.category && !Object.values(LocationCategory).includes(locationData.category)) {
      return NextResponse.json(
        { error: 'Invalid location category' },
        { status: 400 }
      );
    }

    // Check for duplicate locations (within 100m)
    const nearbyLocations = await prisma.$queryRaw`
      SELECT id, name, address, lat, lng,
        ( 6371 * acos( cos( radians(${locationData.lat}) ) 
        * cos( radians( lat ) ) 
        * cos( radians( lng ) - radians(${locationData.lng}) ) 
        + sin( radians(${locationData.lat}) ) 
        * sin( radians( lat ) ) ) ) AS distance
      FROM locations 
      WHERE is_active = true
      HAVING distance < 0.1
      ORDER BY distance
      LIMIT 1
    ` as any[];

    if (nearbyLocations.length > 0) {
      return NextResponse.json(
        { 
          error: 'A location already exists nearby',
          nearbyLocation: nearbyLocations[0]
        },
        { status: 409 }
      );
    }

    // Create new location
    const location = await prisma.location.create({
      data: {
        name: locationData.name,
        address: locationData.address,
        lat: locationData.lat,
        lng: locationData.lng,
        category: locationData.category || 'CUSTOM',
        icon: locationData.icon || 'building',
        description: locationData.description,
        isActive: true,
        searchCount: 0
      }
    });

    return NextResponse.json({
      success: true,
      data: location,
      message: 'Location created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Create location error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create location',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('id');

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    const updateData = await request.json();

    // Validate coordinates if provided
    if (updateData.lat !== undefined && (typeof updateData.lat !== 'number' || updateData.lat < -90 || updateData.lat > 90)) {
      return NextResponse.json(
        { error: 'Invalid latitude' },
        { status: 400 }
      );
    }

    if (updateData.lng !== undefined && (typeof updateData.lng !== 'number' || updateData.lng < -180 || updateData.lng > 180)) {
      return NextResponse.json(
        { error: 'Invalid longitude' },
        { status: 400 }
      );
    }

    // Validate category if provided
    if (updateData.category && !Object.values(LocationCategory).includes(updateData.category)) {
      return NextResponse.json(
        { error: 'Invalid location category' },
        { status: 400 }
      );
    }

    // Check if location exists
    const existingLocation = await prisma.location.findUnique({
      where: { id: locationId }
    });

    if (!existingLocation) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    // Update location
    const updatedLocation = await prisma.location.update({
      where: { id: locationId },
      data: {
        ...updateData,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedLocation,
      message: 'Location updated successfully'
    });

  } catch (error) {
    console.error('Update location error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update location',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('id');

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    // Check if location exists
    const existingLocation = await prisma.location.findUnique({
      where: { id: locationId }
    });

    if (!existingLocation) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    // Soft delete - mark as inactive instead of hard delete
    await prisma.location.update({
      where: { id: locationId },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Location deleted successfully'
    });

  } catch (error) {
    console.error('Delete location error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to delete location',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}