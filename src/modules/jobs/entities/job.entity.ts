import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
  JoinColumn,
} from 'typeorm';
import { Source } from './source.entity';
import { Company } from '../../companies/entities/company.entity';

@Entity('jobs')
@Unique('UQ_job_source_external', ['sourceId', 'externalJobId'])
@Index('IDX_job_posted_date', ['postedDate'])
@Index('IDX_job_company_posted', ['companyId', 'postedDate'])
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sourceId: number;

  @ManyToOne(() => Source, (s) => s.jobs)
  @JoinColumn({ name: 'sourceId' })
  source: Source;

  @Column()
  externalJobId: string;

  @Column()
  sourceJobUrl: string;

  @Column('uuid', { nullable: true })
  companyId: string;

  @ManyToOne(() => Company, (c) => c.jobs, { nullable: true })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column()
  title: string;

  @Column({ nullable: true })
  locationText: string;

  @Column('text', { nullable: true })
  descriptionText: string;

  @Column()
  applyUrl: string;

  @Column({ type: 'date', nullable: true })
  postedDate: Date;

  @Column({ type: 'timestamp' })
  firstSeenAt: Date;

  @Column({ type: 'timestamp' })
  lastSeenAt: Date;

  @Column({ default: 'active' })
  status: string; // active | expired | removed

  @Column({ nullable: true })
  contentHash: string;

  // pgvector embedding — stored as float[] and cast via pgvector
  @Column('float', { array: true, nullable: true })
  embedding: number[];

  @Column({ nullable: true })
  embeddingModel: string;

  @Column({ nullable: true })
  embeddingVersion: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
