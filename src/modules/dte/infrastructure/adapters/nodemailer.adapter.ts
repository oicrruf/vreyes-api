import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import {
  EmailSenderPort,
  EmailAttachmentPayload,
  EmailSendResult,
} from '../../domain/ports/email-sender.port';

@Injectable()
export class NodemailerAdapter implements EmailSenderPort {
  async send(
    to: string | string[],
    attachments: EmailAttachmentPayload[],
    subject: string,
    text: string,
  ): Promise<EmailSendResult> {
    if (!attachments?.length) {
      return { success: false, error: 'No attachments provided' };
    }

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS,
        },
      });

      const recipients = Array.isArray(to) ? to.join(',') : to;

      const info = await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: recipients,
        cc: process.env.GMAIL_USER,
        subject,
        text,
        attachments,
      });

      return { success: true, messageId: info.messageId };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}
