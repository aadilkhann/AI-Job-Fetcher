import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Job } from '../../jobs/entities/job.entity';

@Entity('sources')
export class Source {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string; // greenhouse | lever | workday | ashby | smartrecruiters | jobboard | custom

  @OneToMany(() => Job, (j) => j.source)
  jobs: Job[];
}
