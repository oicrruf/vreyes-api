import { DateRange } from '../value-objects/date-range.vo';

export const EMAIL_READER = 'EMAIL_READER';

export interface EmailAttachmentData {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface EmailData {
  uid: number;
  from: string;
  subject: string;
  date: string;
  body?: string;
  attachments?: EmailAttachmentData[];
}

export interface EmailReaderPort {
  readEmails(dateRange: DateRange): Promise<EmailData[]>;
}
