import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Resume } from '../../resume/entities/resume.entity';
import { UserCompanyTarget } from '../../companies/entities/user-company-target.entity';
import { UserSearchProfile } from './user-search-profile.entity';
import { JobMatch } from '../../matching/entities/job-match.entity';
import { Notification } from '../../notify/entities/notification.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ nullable: true })
  timezone: string;

  @Column({ type: 'jsonb', default: '{}' })
  notificationPrefs: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ── Relations ──
  @OneToMany(() => Resume, (r) => r.user)
  resumes: Resume[];

  @OneToMany(() => UserCompanyTarget, (t) => t.user)
  companyTargets: UserCompanyTarget[];

  @OneToMany(() => UserSearchProfile, (p) => p.user)
  searchProfiles: UserSearchProfile[];

  @OneToMany(() => JobMatch, (m) => m.user)
  jobMatches: JobMatch[];

  @OneToMany(() => Notification, (n) => n.user)
  notifications: Notification[];
}
