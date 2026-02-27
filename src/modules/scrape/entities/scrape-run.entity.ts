import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('scrape_runs')
export class ScrapeRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  targetUrl: string;

  @Column({ nullable: true })
  sourceId: number;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt: Date;

  @Column({ default: 'running' })
  status: string; // running | completed | failed

  @Column({ nullable: true })
  httpStatus: number;

  @Column({ nullable: true })
  errorCode: string;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ default: 0 })
  jobsFetched: number;

  @Column({ default: 0 })
  jobsNew: number;
}
