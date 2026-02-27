import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Notification } from './notification.entity';
import { Job } from '../../jobs/entities/job.entity';

@Entity('notification_job_links')
export class NotificationJobLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  notificationId: string;

  @ManyToOne(() => Notification, (n) => n.jobLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notificationId' })
  notification: Notification;

  @Column('uuid')
  jobId: string;

  @ManyToOne(() => Job)
  @JoinColumn({ name: 'jobId' })
  job: Job;
}
