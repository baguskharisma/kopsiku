import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import * as usersService from './users.service';
import { RequestUser } from '../auth/interfaces/request-with-user.interface';
import { AuthRequired } from 'src/decorators/auth-required.decorator';
import { GetUserId } from 'src/decorators/user.decorator';
import { ChangePasswordDto } from 'src/auth/dto/change-password.dto';
import { AdminOnly } from 'src/decorators/admin-only.decorator';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: usersService.UsersService) {}

  @Get('me')
  @AuthRequired()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  async getProfile(@GetUserId() userId: string) {
    return this.usersService.findById(userId);
  }

  @Put('me')
  @AuthRequired()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @GetUserId() userId: string,
    @Body() updateUserDto: usersService.UpdateUserDto,
  ) {
    return this.usersService.update(userId, updateUserDto);
  }

  @Post('change-password')
  @AuthRequired()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(
    @GetUserId() userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(
      userId,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
    return { message: 'Password berhasil diubah' };
  }

  @Get()
  @AdminOnly()
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: Role,
    description: 'Filter by role',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by name, phone, or email',
  })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: Role,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    const options = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      role,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search,
    };

    return this.usersService.findMany(options);
  }

  @Get(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Put(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update user by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: usersService.UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Post(':id/deactivate')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deactivateUser(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.deactivate(id);
    return { message: 'User berhasil dinonaktifkan' };
  }

  @Post(':id/activate')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async activateUser(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.activate(id);
    return { message: 'User berhasil diaktifkan' };
  }

  @Post(':id/verify')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User verified successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async verifyUser(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.verifyUser(id);
    return { message: 'User berhasil diverifikasi' };
  }
}
