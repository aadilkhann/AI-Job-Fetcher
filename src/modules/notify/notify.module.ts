import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { NotifyService } from './notify.service';
import { NotifyWorker } from './notify.worker';
import { EmailService } from './email.service';
import { Notification } from './entities/notification.entity';
import { NotificationJobLink } from './entities/notification-job-link.entity';
import { User } from '../users/entities/user.entity';
import { Job } from '../jobs/entities/job.entity';
import { JobMatch } from '../matching/entities/job-match.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationJobLink,
      User,
      Job,
      JobMatch,
    ]),
    BullModule.registerQueue({ name: 'notify.prepare' }),
  ],
  providers: [NotifyService, NotifyWorker, EmailService],
  exports: [NotifyService],
})
export class NotifyModule {}
