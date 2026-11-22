import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto/user.dto';

// Solo el dueño (sin @AllowRoles: cerrado por defecto, ver auth/roles.ts).
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  findAll() {
    return this.users.findAll();
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.users.update(id, dto, req.user.sub);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/reset-password')
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.users.resetPassword(id, dto);
  }
}
