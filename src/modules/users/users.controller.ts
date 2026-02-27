import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import {
  UpdateSearchProfileDto,
  UpdateNotificationPrefsDto,
} from './dto/user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@Request() req: any) {
    return this.usersService.findById(req.user.userId);
  }

  @Get('me/search-profile')
  getSearchProfile(@Request() req: any) {
    return this.usersService.getSearchProfile(req.user.userId);
  }

  @Put('me/search-profile')
  updateSearchProfile(
    @Request() req: any,
    @Body() dto: UpdateSearchProfileDto,
  ) {
    return this.usersService.updateSearchProfile(req.user.userId, dto);
  }

  @Put('me/notification-prefs')
  updateNotificationPrefs(
    @Request() req: any,
    @Body() dto: UpdateNotificationPrefsDto,
  ) {
    return this.usersService.updateNotificationPrefs(req.user.userId, dto);
  }
}
