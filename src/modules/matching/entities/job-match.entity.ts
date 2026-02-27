import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Unique,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Job } from '../../jobs/entities/job.entity';

@Entity('job_matches')
@Unique('UQ_match_user_job_model', ['userId', 'jobId', 'modelVersion'])
@Index('IDX_match_user_score', ['userId', 'finalScore'])
export class JobMatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, (u) => u.jobMatches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  jobId: string;

  @ManyToOne(() => Job)
  @JoinColumn({ name: 'jobId' })
  job: Job;

  @Column('float', { default: 0 })
  keywordScore: number;

  @Column('float', { default: 0 })
  vectorScore: number;

  @Column('float', { default: 0 })
  finalScore: number;

  @Column()
  modelVersion: string;

  @Column('jsonb', { nullable: true })
  reasonJson: Record<string, any>;

  @CreateDateColumn()
  matchedAt: Date;
}
