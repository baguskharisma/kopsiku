import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { DriverStatus } from '@prisma/client';
import { DriverProfileService } from './driver-profile.service';
import {
  CreateDriverProfileDto,
  UpdateDriverProfileDto,
  VerifyDriverQrImageDto,
  UpdateDriverQrImageDto,
  DriverProfileResponseDto,
} from './dto/driver-profile.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { GetUserId } from 'src/decorators/user.decorator';
import { AdminOnly } from 'src/decorators/admin-only.decorator';
import { DriverOnly } from 'src/decorators/driver-only.decorator';
import { AuthRequired } from 'src/decorators/auth-required.decorator';

@ApiTags('Driver Profile')
@Controller('driver-profile')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DriverProfileController {
  constructor(private readonly driverProfileService: DriverProfileService) {}

  @Post()
  @DriverOnly()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create driver profile (Driver only)',
    description:
      'Create a new driver profile. Only users with DRIVER role can create driver profiles.',
  })
  @ApiResponse({
    status: 201,
    description: 'Driver profile created successfully',
    type: DriverProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation errors' })
  @ApiResponse({ status: 403, description: 'Forbidden - user is not a driver' })
  @ApiResponse({
    status: 409,
    description: 'Conflict - profile already exists or duplicate data',
  })
  async createProfile(
    @GetUserId() userId: string,
    @Body() createDriverProfileDto: CreateDriverProfileDto,
  ): Promise<DriverProfileResponseDto> {
    return this.driverProfileService.createDriverProfile(
      userId,
      createDriverProfileDto,
    );
  }

  @Get('me')
  @DriverOnly()
  @ApiOperation({
    summary: 'Get my driver profile (Driver only)',
    description:
      "Get the current driver's profile information including QR image status.",
  })
  @ApiResponse({
    status: 200,
    description: 'Driver profile retrieved successfully',
    type: DriverProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Driver profile not found' })
  async getMyProfile(
    @GetUserId() userId: string,
  ): Promise<DriverProfileResponseDto> {
    return this.driverProfileService.getDriverProfile(userId);
  }

  @Put('me')
  @DriverOnly()
  @ApiOperation({
    summary: 'Update my driver profile (Driver only)',
    description:
      "Update the current driver's profile. Updating QR image will reset verification status.",
  })
  @ApiResponse({
    status: 200,
    description: 'Driver profile updated successfully',
    type: DriverProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation errors' })
  @ApiResponse({ status: 404, description: 'Driver profile not found' })
  @ApiResponse({ status: 409, description: 'Conflict - duplicate data' })
  async updateMyProfile(
    @GetUserId() userId: string,
    @Body() updateDriverProfileDto: UpdateDriverProfileDto,
  ): Promise<DriverProfileResponseDto> {
    return this.driverProfileService.updateDriverProfile(
      userId,
      updateDriverProfileDto,
    );
  }

  @Patch('me/qr-image')
  @DriverOnly()
  @ApiOperation({
    summary: 'Update QR image (Driver only)',
    description:
      'Update or upload QR code image for bank account. This will reset verification status.',
  })
  @ApiResponse({
    status: 200,
    description: 'QR image updated successfully',
    type: DriverProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid URL' })
  @ApiResponse({ status: 404, description: 'Driver profile not found' })
  async updateQrImage(
    @GetUserId() userId: string,
    @Body() updateQrImageDto: UpdateDriverQrImageDto,
  ): Promise<DriverProfileResponseDto> {
    return this.driverProfileService.updateDriverQrImage(
      userId,
      updateQrImageDto,
    );
  }

  // Admin endpoints
  @Get()
  @AdminOnly()
  @ApiOperation({
    summary: 'Get all driver profiles (Admin only)',
    description:
      'Get paginated list of all driver profiles with filtering options.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: DriverStatus,
    description: 'Filter by driver status',
  })
  @ApiQuery({
    name: 'isVerified',
    required: false,
    type: Boolean,
    description: 'Filter by verification status',
  })
  @ApiQuery({
    name: 'qrImageVerified',
    required: false,
    type: Boolean,
    description: 'Filter by QR image verification status',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description:
      'Search by license number, ID card, address, bank account, or user info',
  })
  @ApiResponse({
    status: 200,
    description: 'Driver profiles retrieved successfully',
  })
  async getAllProfiles(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: DriverStatus,
    @Query('isVerified') isVerified?: string,
    @Query('qrImageVerified') qrImageVerified?: string,
    @Query('search') search?: string,
  ) {
    const options = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      status,
      isVerified: isVerified !== undefined ? isVerified === 'true' : undefined,
      qrImageVerified:
        qrImageVerified !== undefined ? qrImageVerified === 'true' : undefined,
      search,
    };

    return this.driverProfileService.getAllDriverProfiles(options);
  }

  @Get('unverified-qr-images')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get drivers with unverified QR images (Admin only)',
    description:
      'Get list of drivers who have uploaded QR images but are not yet verified.',
  })
  @ApiResponse({
    status: 200,
    description: 'Unverified QR images retrieved successfully',
  })
  async getUnverifiedQrImages() {
    return this.driverProfileService.getUnverifiedQrImages();
  }

  @Get(':id')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get driver profile by ID (Admin only)',
    description: 'Get detailed driver profile information by profile ID.',
  })
  @ApiParam({ name: 'id', description: 'Driver profile ID' })
  @ApiResponse({
    status: 200,
    description: 'Driver profile retrieved successfully',
    type: DriverProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Driver profile not found' })
  async getProfileById(
    @Param('id', ParseUUIDPipe) profileId: string,
  ): Promise<DriverProfileResponseDto> {
    return this.driverProfileService.getDriverProfileById(profileId);
  }

  @Post(':id/verify-qr-image')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify or reject driver QR image (Admin only)',
    description: "Verify or reject a driver's QR code image for bank account.",
  })
  @ApiParam({ name: 'id', description: 'Driver profile ID' })
  @ApiResponse({
    status: 200,
    description: 'QR image verification status updated successfully',
    type: DriverProfileResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - QR image not uploaded',
  })
  @ApiResponse({ status: 404, description: 'Driver profile not found' })
  async verifyQrImage(
    @Param('id', ParseUUIDPipe) profileId: string,
    @GetUserId() adminUserId: string,
    @Body() verifyQrImageDto: VerifyDriverQrImageDto,
  ): Promise<DriverProfileResponseDto> {
    return this.driverProfileService.verifyDriverQrImage(
      profileId,
      adminUserId,
      verifyQrImageDto,
    );
  }

  @Post(':id/verify')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify driver profile (Admin only)',
    description:
      'Verify driver profile and update status. This is separate from QR image verification.',
  })
  @ApiParam({ name: 'id', description: 'Driver profile ID' })
  @ApiResponse({
    status: 200,
    description: 'Driver profile verified successfully',
  })
  @ApiResponse({ status: 404, description: 'Driver profile not found' })
  async verifyProfile(
    @Param('id', ParseUUIDPipe) profileId: string,
    @GetUserId() adminUserId: string,
    @Body() body: { notes?: string },
  ) {
    // This would be implemented in the service
    // For now, return a simple success message
    return {
      message: 'Driver profile verified successfully',
      verifiedBy: adminUserId,
      notes: body.notes,
    };
  }

  // Additional endpoint for getting QR image verification statistics
  @Get('stats/qr-verification')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get QR image verification statistics (Admin only)',
    description:
      'Get statistics about QR image verification status across all drivers.',
  })
  @ApiResponse({
    status: 200,
    description: 'QR verification statistics retrieved successfully',
  })
  async getQrVerificationStats() {
    // This would be implemented to return statistics like:
    // - Total drivers with QR images
    // - Verified QR images count
    // - Pending verification count
    // - etc.
    return {
      message: 'QR verification statistics endpoint - to be implemented',
    };
  }
}
