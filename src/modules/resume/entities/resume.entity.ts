import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('resumes')
@Unique('UQ_resume_user_hash', ['userId', 'sha256'])
export class Resume {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, (u) => u.resumes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  fileUrl: string;

  @Column()
  mimeType: string;

  @Column()
  sha256: string;

  @Column({ default: 'pending' })
  parseStatus: string; // pending | parsed | failed

  @Column('text', { nullable: true })
  parsedText: string;

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
