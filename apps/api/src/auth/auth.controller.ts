import { 
  Controller, 
  Post, 
  Get,
  Body, 
  UseGuards, 
  Request, 
  HttpCode, 
  HttpStatus,
  ValidationPipe,
  UsePipes,
  Ip,
  Headers,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from 'src/auth/dto/login.dto';
import { Public } from 'src/decorators/public.decorator';
import { RegisterDto } from 'src/auth/dto/register.dto';
import { RefreshTokenDto } from 'src/auth/dto/refresh-token.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';


@Controller('auth')
@UsePipes(new ValidationPipe({ transform: true }))
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string
  ) {
    // Extract device info and add to login
    const loginWithDevice = {
      ...loginDto,
      ipAddress,
      userAgent,
    };
    
    return this.authService.login(loginWithDevice);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req, @Body() body: { deviceId?: string }) {
    return this.authService.logout(req.user.id, body.deviceId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAllDevices(@Request() req) {
    return this.authService.logoutAllDevices(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-token')
  @HttpCode(HttpStatus.OK)
  async verifyToken(@Request() req) {
    return {
      valid: true,
      user: {
        id: req.user.id,
        name: req.user.name,
        phone: req.user.phone,
        email: req.user.email,
        role: req.user.role,
        avatarUrl: req.user.avatarUrl,
        isVerified: req.user.isVerified,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  async getActiveSessions(@Request() req) {
    const sessions = await this.authService.getActiveSessions(req.user.id);
    return {
      sessions,
      total: sessions.length,
    };
  }
}