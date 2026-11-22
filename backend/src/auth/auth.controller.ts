import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard, type AuthenticatedUser } from './jwt-auth.guard';
import { AllowRoles } from './roles';

type AuthedRequest = Request & { user: AuthenticatedUser };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  // Cualquier usuario del panel: quién soy y qué puedo ver.
  @UseGuards(JwtAuthGuard)
  @AllowRoles('VENDEDOR')
  @Get('me')
  me(@Req() req: AuthedRequest) {
    return this.authService.me(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @AllowRoles('VENDEDOR')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('change-password')
  changePassword(@Body() body: ChangePasswordDto, @Req() req: AuthedRequest) {
    // La sesión nueva dura lo mismo que la actual (con o sin "Recordarme").
    return this.authService.changePassword(
      req.user.sub,
      body,
      req.user.remember,
    );
  }
}
