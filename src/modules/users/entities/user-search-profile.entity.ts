import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_search_profiles')
export class UserSearchProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, (u) => u.searchProfiles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('text', { array: true, default: '{}' })
  keywordsInclude: string[];

  @Column('text', { array: true, default: '{}' })
  keywordsExclude: string[];

  @Column('text', { array: true, default: '{}' })
  preferredLocations: string[];

  @Column({ nullable: true })
  seniority: string;

  @Column({ nullable: true })
  remotePref: string; // 'remote' | 'hybrid' | 'onsite' | null

  @UpdateDateColumn()
  updatedAt: Date;
}
