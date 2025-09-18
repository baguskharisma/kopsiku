import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcryptjs';
import { OtpService } from 'src/otp/otp.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;

  const mockUsersService = {
    findByPhone: jest.fn(),
    create: jest.fn(),
    saveRefreshToken: jest.fn(),
    updateLastLogin: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verify: jest.fn(),
  };

  const mockOtpService = {
    sendOtp: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: OtpService, useValue: mockOtpService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user object when credentials are valid', async () => {
      const mockUser = {
        id: '1',
        phone: '1234567890',
        passwordHash: await bcrypt.hash('password123', 10),
      };

      mockUsersService.findByPhone.mockResolvedValue(mockUser);

      const result = await service.validateUser('1234567890', 'password123');
      expect(result).toBeDefined();
      expect(result.id).toBe('1');
    });

    it('should return null when credentials are invalid', async () => {
      mockUsersService.findByPhone.mockResolvedValue(null);

      const result = await service.validateUser('1234567890', 'wrongpassword');
      expect(result).toBeNull();
    });
  });
});
