import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', 'localhost'),
      port: parseInt(this.config.get('SMTP_PORT', '587'), 10),
      secure: false,
      auth: {
        user: this.config.get('SMTP_USER', ''),
        pass: this.config.get('SMTP_PASS', ''),
      },
    });
  }

  async send(payload: EmailPayload): Promise<string | null> {
    try {
      const info = await this.transporter.sendMail({
        from: this.config.get('SMTP_FROM', 'AI Job Fetcher <noreply@localhost>'),
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      });
      this.logger.log(`Email sent to ${payload.to}: ${info.messageId}`);
      return info.messageId;
    } catch (err: any) {
      this.logger.error(`Email failed to ${payload.to}: ${err.message}`);
      return null;
    }
  }
}
