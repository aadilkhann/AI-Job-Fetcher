import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Company } from './company.entity';

@Entity('user_company_targets')
export class UserCompanyTarget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, (u) => u.companyTargets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid', { nullable: true })
  companyId: string;

  @ManyToOne(() => Company, (c) => c.targets, { nullable: true })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column()
  careerUrl: string;

  @Column({ nullable: true })
  sourceHint: string; // greenhouse | lever | workday | ashby | smartrecruiters | generic

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
