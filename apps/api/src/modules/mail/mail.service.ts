import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../../config/env';

export interface OutgoingMail { to: string; subject: string; text: string; html: string }

/**
 * SMTP mailer. Without SMTP_HOST it is a no-op: in development the message (including the one-time link)
 * is logged so flows stay testable; in production nothing sensitive is logged.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private readonly transport?: Transporter;
  private readonly from: string;
  private readonly dev: boolean;

  constructor(config: ConfigService<Env, true>) {
    const host = config.get('SMTP_HOST', { infer: true });
    this.from = config.get('MAIL_FROM', { infer: true });
    this.dev = config.get('NODE_ENV', { infer: true }) !== 'production';
    if (host) {
      const user = config.get('SMTP_USER', { infer: true });
      const pass = config.get('SMTP_PASS', { infer: true });
      this.transport = createTransport({
        host,
        port: config.get('SMTP_PORT', { infer: true }),
        secure: config.get('SMTP_SECURE', { infer: true }),
        ...(user ? { auth: { user, pass } } : {}),
        connectionTimeout: 10_000,
        socketTimeout: 15_000,
      });
    } else {
      this.log.warn('SMTP_HOST is not set – outgoing email is DISABLED');
    }
  }

  get enabled() {
    return !!this.transport;
  }

  /** Never throws: callers fire-and-forget so a mail outage cannot break registration or reveal account existence. */
  async send(mail: OutgoingMail): Promise<boolean> {
    if (!this.transport) {
      if (this.dev) this.log.warn(`[mail disabled] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
      return false;
    }
    try {
      await this.transport.sendMail({ from: this.from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
      return true;
    } catch (e) {
      this.log.error(`Failed to send "${mail.subject}": ${(e as Error).message}`);
      return false;
    }
  }
}
