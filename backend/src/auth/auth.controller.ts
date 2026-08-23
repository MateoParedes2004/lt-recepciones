import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    // Solo un admin ya logueado puede crear otro admin.
    @UseGuards(JwtAuthGuard)
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    @Post('register')
    register(@Body() body: RegisterDto) {
    return this.authService.register(body);
    }

    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    @Post('login')
    login(@Body() body: LoginDto) {
    return this.authService.login(body);
    }
}