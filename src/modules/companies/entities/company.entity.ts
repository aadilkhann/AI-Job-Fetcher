import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Job } from '../../jobs/entities/job.entity';
import { UserCompanyTarget } from './user-company-target.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true, unique: true })
  canonicalDomain: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Job, (j) => j.company)
  jobs: Job[];

  @OneToMany(() => UserCompanyTarget, (t) => t.company)
  targets: UserCompanyTarget[];
}
