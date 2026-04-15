export const EMAIL_SENDER = 'EMAIL_SENDER';

export interface EmailAttachmentPayload {
  filename: string;
  content: Buffer;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailSenderPort {
  send(
    to: string | string[],
    attachments: EmailAttachmentPayload[],
    subject: string,
    text: string,
  ): Promise<EmailSendResult>;
}
