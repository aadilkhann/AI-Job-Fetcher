import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Unique,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NotificationJobLink } from './notification-job-link.entity';

@Entity('notifications')
@Unique('UQ_notification_dedupe', ['dedupeKey'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, (u) => u.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ default: 'email' })
  channel: string;

  @Column({ default: 'digest' })
  type: string; // realtime | digest

  @Column({ default: 'pending' })
  status: string; // pending | sent | failed | bounced

  @Column()
  dedupeKey: string;

  @Column('jsonb', { nullable: true })
  payloadJson: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date;

  @Column({ nullable: true })
  providerMessageId: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => NotificationJobLink, (l) => l.notification)
  jobLinks: NotificationJobLink[];
}
