import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';

import { Notification } from './entities/notification.entity';
import { NotificationJobLink } from './entities/notification-job-link.entity';
import { EmailService } from './email.service';
import { User } from '../users/entities/user.entity';
import { Job as JobEntity } from '../jobs/entities/job.entity';
import { JobMatch } from '../matching/entities/job-match.entity';

@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(NotificationJobLink)
    private readonly linkRepo: Repository<NotificationJobLink>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(JobMatch)
    private readonly matchRepo: Repository<JobMatch>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Prepare and send a notification for a match.
   * Uses dedupeKey to prevent duplicate sends.
   */
  async prepareAndSend(
    userId: string,
    jobId: string,
    matchId: string,
    score: number,
    type: 'realtime' | 'digest',
  ): Promise<void> {
    const dedupeKey = createHash('sha256')
      .update(`${userId}:${jobId}:${type}`)
      .digest('hex');

    // Check for duplicate
    const existing = await this.notifRepo.findOne({
      where: { dedupeKey },
    });
    if (existing) {
      this.logger.debug(`Skipping duplicate notification: ${dedupeKey}`);
      return;
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!user || !job) return;

    // Create notification record
    const notif = this.notifRepo.create({
      userId,
      channel: 'email',
      type,
      status: 'pending',
      dedupeKey,
      payloadJson: {
        jobTitle: job.title,
        company: job.locationText,
        applyUrl: job.applyUrl,
        score,
      },
      scheduledAt: type === 'digest' ? this.nextDigestTime() : new Date(),
    });
    await this.notifRepo.save(notif);

    // Link notification to job
    await this.linkRepo.save(
      this.linkRepo.create({ notificationId: notif.id, jobId }),
    );

    // Send immediately for realtime, skip for digest (handled by digest cron)
    if (type === 'realtime') {
      await this.sendNotification(notif, user, [job]);
    }
  }

  /**
   * Process pending digest notifications: aggregate and send.
   */
  async sendPendingDigests(): Promise<number> {
    const pendingDigests = await this.notifRepo
      .createQueryBuilder('n')
      .where('n.type = :type', { type: 'digest' })
      .andWhere('n.status = :status', { status: 'pending' })
      .andWhere('n.scheduledAt <= :now', { now: new Date() })
      .getMany();

    // Group by user
    const byUser = new Map<string, Notification[]>();
    for (const n of pendingDigests) {
      if (!byUser.has(n.userId)) byUser.set(n.userId, []);
      byUser.get(n.userId)!.push(n);
    }

    let sentCount = 0;
    for (const [userId, notifs] of byUser) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) continue;

      // Gather jobs for email
      const jobIds = await this.linkRepo
        .createQueryBuilder('l')
        .where('l.notificationId IN (:...ids)', {
          ids: notifs.map((n) => n.id),
        })
        .getMany();

      const jobs = await this.jobRepo
        .createQueryBuilder('j')
        .whereInIds(jobIds.map((l) => l.jobId))
        .getMany();

      // Send digest email
      const html = this.buildDigestHtml(jobs);
      const messageId = await this.emailService.send({
        to: user.email,
        subject: `🎯 AI Job Fetcher: ${jobs.length} new job matches`,
        html,
      });

      // Update notification records
      for (const n of notifs) {
        n.status = messageId ? 'sent' : 'failed';
        n.sentAt = new Date();
        n.providerMessageId = messageId || '';
        await this.notifRepo.save(n);
      }

      sentCount += notifs.length;
    }

    this.logger.log(`Digest: sent ${sentCount} notifications to ${byUser.size} users`);
    return sentCount;
  }

  private async sendNotification(
    notif: Notification,
    user: User,
    jobs: JobEntity[],
  ): Promise<void> {
    const html = this.buildRealtimeHtml(jobs[0]);
    const messageId = await this.emailService.send({
      to: user.email,
      subject: `🎯 New match: ${jobs[0].title}`,
      html,
    });

    notif.status = messageId ? 'sent' : 'failed';
    notif.sentAt = new Date();
    notif.providerMessageId = messageId || '';
    await this.notifRepo.save(notif);
  }

  private buildRealtimeHtml(job: JobEntity): string {
    return `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2>New Job Match!</h2>
        <h3>${this.escapeHtml(job.title)}</h3>
        <p><strong>Location:</strong> ${this.escapeHtml(job.locationText ?? 'Not specified')}</p>
        <p>${this.escapeHtml((job.descriptionText ?? '').slice(0, 300))}...</p>
        <p><a href="${this.escapeHtml(job.applyUrl)}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Apply Now</a></p>
      </div>
    `;
  }

  private buildDigestHtml(jobs: JobEntity[]): string {
    const jobItems = jobs
      .map(
        (j) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            <a href="${this.escapeHtml(j.applyUrl)}">${this.escapeHtml(j.title)}</a>
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            ${this.escapeHtml(j.locationText ?? 'N/A')}
          </td>
        </tr>`,
      )
      .join('');

    return `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2>Your Job Match Digest</h2>
        <p>We found <strong>${jobs.length}</strong> matching jobs for you:</p>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: left; padding: 8px; border-bottom: 2px solid #333;">Job Title</th>
              <th style="text-align: left; padding: 8px; border-bottom: 2px solid #333;">Location</th>
            </tr>
          </thead>
          <tbody>${jobItems}</tbody>
        </table>
      </div>
    `;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private nextDigestTime(): Date {
    const now = new Date();
    // Next digest at 9 AM UTC
    const next = new Date(now);
    next.setUTCHours(9, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }
}
