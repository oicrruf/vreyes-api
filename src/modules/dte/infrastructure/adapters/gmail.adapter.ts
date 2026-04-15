import { Injectable } from '@nestjs/common';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { EmailReaderPort, EmailData } from '../../domain/ports/email-reader.port';
import { DateRange } from '../../domain/value-objects/date-range.vo';

@Injectable()
export class GmailAdapter implements EmailReaderPort {
  async readEmails(dateRange: DateRange): Promise<EmailData[]> {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: process.env.GMAIL_USER ?? '',
        password: process.env.GMAIL_PASS ?? '',
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
      });

      const emails: EmailData[] = [];

      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err) => {
          if (err) {
            imap.end();
            return reject(new Error('Failed to open inbox'));
          }

          const searchCriteria = [
            ['SINCE', dateRange.after.toISOString().split('T')[0]],
            ['BEFORE', dateRange.before.toISOString().split('T')[0]],
          ];

          imap.search(searchCriteria, (searchErr, results) => {
            if (searchErr) {
              imap.end();
              return reject(new Error('Failed to search emails'));
            }

            if (!results?.length) {
              imap.end();
              return resolve([]);
            }

            const messagePromises: Promise<void>[] = [];

            const fetch = imap.fetch(results, {
              bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', ''],
              struct: true,
            });

            fetch.on('message', (msg: any) => {
              const emailData: EmailData = {
                uid: 0,
                from: '',
                subject: '',
                date: '',
                body: '',
                attachments: [],
              };

              const parsePromise = new Promise<void>((resolveMsg) => {
                msg.on('body', (stream: any, info: any) => {
                  if (info.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)') {
                    let buffer = '';
                    stream.on('data', (chunk: any) => {
                      buffer += chunk.toString('utf8');
                    });
                    stream.on('end', () => {
                      const header = Imap.parseHeader(buffer);
                      emailData.from = header.from?.[0] ?? 'Unknown';
                      emailData.subject = header.subject?.[0] ?? 'No Subject';
                      emailData.date = header.date?.[0] ?? 'Unknown Date';
                    });
                  } else {
                    simpleParser(stream, {}, (parseErr, parsed) => {
                      if (!parseErr && parsed) {
                        emailData.body = parsed.text || (parsed.html as string) || '';
                        if (parsed.attachments?.length) {
                          emailData.attachments = parsed.attachments.map((a) => ({
                            filename: (a.filename || '') as string,
                            content: a.content as Buffer,
                            contentType: (a.contentType || 'application/octet-stream') as string,
                          }));
                        }
                      }
                      resolveMsg();
                    });
                  }
                });

                msg.once('attributes', (attrs: any) => {
                  emailData.uid = attrs.uid;
                });

                msg.once('end', () => {
                  emails.push(emailData);
                });
              });

              messagePromises.push(parsePromise);
            });

            fetch.once('error', () => {
              imap.end();
              reject(new Error('Error fetching emails'));
            });

            fetch.once('end', async () => {
              imap.end();
              await Promise.all(messagePromises);
              resolve(emails);
            });
          });
        });
      });

      imap.once('error', () => reject(new Error('IMAP connection error')));
      imap.connect();
    });
  }
}
