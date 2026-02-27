import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserSearchProfile } from './entities/user-search-profile.entity';
import {
  UpdateSearchProfileDto,
  UpdateNotificationPrefsDto,
} from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserSearchProfile)
    private readonly profileRepo: Repository<UserSearchProfile>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getSearchProfile(userId: string): Promise<UserSearchProfile> {
    let profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = this.profileRepo.create({ userId });
      await this.profileRepo.save(profile);
    }
    return profile;
  }

  async updateSearchProfile(
    userId: string,
    dto: UpdateSearchProfileDto,
  ): Promise<UserSearchProfile> {
    let profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = this.profileRepo.create({ userId, ...dto });
    } else {
      Object.assign(profile, dto);
    }
    return this.profileRepo.save(profile);
  }

  async updateNotificationPrefs(
    userId: string,
    dto: UpdateNotificationPrefsDto,
  ): Promise<User> {
    const user = await this.findById(userId);
    user.notificationPrefs = { ...user.notificationPrefs, ...dto };
    if (dto.timezone) user.timezone = dto.timezone;
    return this.userRepo.save(user);
  }
}
