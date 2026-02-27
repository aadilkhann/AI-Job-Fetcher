import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';

import { SchedulerService } from './scheduler.service';
import { CompaniesModule } from '../companies/companies.module';
import { NotifyModule } from '../notify/notify.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.registerQueue({ name: 'scrape.target' }),
    CompaniesModule,
    NotifyModule,
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}
