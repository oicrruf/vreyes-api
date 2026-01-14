import Imap from "imap";
import dotenv from "dotenv";
import { simpleParser } from "mailparser";

dotenv.config();

// Define interfaces for type safety
export interface EmailData {
  uid: number;
  from: string;
  subject: string;
  date: string;
  body?: string;
  nrc?: string;
  attachments?: any[];
}

export interface EmailResponse {
  success: boolean;
  data?: EmailData[];
  message?: string;
  error?: string;
}

// Create an IMAP connection using environment variables
const createImapConnection = () => {
  return new Imap({
    user: process.env.GMAIL_USER || "",
    password: process.env.GMAIL_PASS || "",
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  });
};

// Text normalization for case and accent insensitive comparison
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

// Function to check if text contains the target term (case and accent insensitive)
const containsTermInsensitive = (text: string, term: string): boolean => {
  if (!text) return false;
  return normalizeText(text).includes(normalizeText(term));
};

// Filter emails by subject and optional body terms
export const filterEmailsByTerm = (
  emails: EmailData[],
  subjectTerm: string,
  bodyTerms?: string | string[]
): EmailData[] => {
  return emails.filter((email) => {
    const subjectMatch = containsTermInsensitive(email.subject, subjectTerm);

    if (!bodyTerms) return subjectMatch;

    const bodyTermsArray = Array.isArray(bodyTerms) ? bodyTerms : [bodyTerms];
    const bodyMatch = bodyTermsArray.some((term) =>
      containsTermInsensitive(email.body || "", term)
    );

    return subjectMatch && bodyMatch;
  });
};

// Get date range for specific month and year
const getDateRangeForMonth = (year?: number, month?: number) => {
  const now = new Date();
  const targetYear = year || now.getFullYear();
  const targetMonth = month ? month - 1 : now.getMonth(); // 0-indexed month

  const firstDay = new Date(targetYear, targetMonth, 1);
  const lastDay = new Date(targetYear, targetMonth + 1, 0);

  return {
    after: firstDay,
    before: lastDay,
  };
};

// Function to parse JSON from text and look for specific NRC
export const hasMatchingNrc = (text: string, targetNrc: string): boolean => {
  try {
    // Try to extract JSON from text (might be embedded in HTML or plain text)
    const jsonMatches = text.match(/\{[\s\S]*?\}/g);

    if (!jsonMatches) return false;

    // Check each potential JSON object
    for (const jsonStr of jsonMatches) {
      try {
        const json = JSON.parse(jsonStr);

        // Check if NRC property exists and matches target
        if (json.nrc && json.nrc === targetNrc) {
          return true;
        }

        // Check nested properties
        for (const key in json) {
          if (typeof json[key] === "object" && json[key] !== null) {
            if (json[key].nrc && json[key].nrc === targetNrc) {
              return true;
            }
          }
        }
      } catch (e) {
        // Invalid JSON, continue to next match
        continue;
      }
    }

    return false;
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return false;
  }
};

// Add NRC info to email data if found
export const extractNrcFromEmail = (emailData: EmailData): EmailData => {
  const body = emailData.body || "";

  // Try to find NRC in the body
  const nrcMatch = body.match(/"nrc"\s*:\s*"(\d+)"/i);
  if (nrcMatch && nrcMatch[1]) {
    emailData.nrc = nrcMatch[1];
  }

  return emailData;
};

// List emails from the specified month (defaults to current)
export const listCurrentMonthEmails = (
  year?: number,
  month?: number
): Promise<EmailResponse> => {
  return new Promise((resolve, reject) => {
    const imap = createImapConnection();
    const emails: EmailData[] = [];

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (err: Error | null, box) => {
        if (err) {
          imap.end();
          return reject({ success: false, error: "Failed to open inbox" });
        }

        const { after, before } = getDateRangeForMonth(year, month);

        const searchCriteria = [
          ["SINCE", after.toISOString().split("T")[0]],
          ["BEFORE", before.toISOString().split("T")[0]],
        ];

        imap.search(searchCriteria, (err: Error | null, results) => {
          if (err) {
            imap.end();
            return reject({ success: false, error: "Failed to search emails" });
          }

          if (!results || results.length === 0) {
            imap.end();
            return resolve({
              success: true,
              data: [],
              message: "No emails found for the current month",
            });
          }

          const fetch = imap.fetch(results, {
            bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE)", ""],
            struct: true,
          });

          fetch.on("message", (msg) => {
            const emailData: EmailData = {
              uid: 0,
              from: "",
              subject: "",
              date: "",
              body: "",
              attachments: [],
            };

            msg.on("body", (stream, info) => {
              if (info.which === "HEADER.FIELDS (FROM TO SUBJECT DATE)") {
                let buffer = "";

                stream.on("data", (chunk) => {
                  buffer += chunk.toString("utf8");
                });

                stream.on("end", () => {
                  const header = Imap.parseHeader(buffer);
                  emailData.from = header.from ? header.from[0] : "Unknown";
                  emailData.subject = header.subject
                    ? header.subject[0]
                    : "No Subject";
                  emailData.date = header.date
                    ? header.date[0]
                    : "Unknown Date";
                });
              } else {
                // This is the full message including body and attachments
                const streamAny = stream as any;
                simpleParser(streamAny, {}, (err, parsed) => {
                  if (err) return;

                  emailData.body = parsed.text || parsed.html || "";

                  if (parsed.attachments && parsed.attachments.length > 0) {
                    emailData.attachments = parsed.attachments;
                  }
                });
              }
            });

            msg.once("attributes", (attrs) => {
              emailData.uid = attrs.uid;
            });

            msg.once("end", () => {
              // Extract NRC info if present
              emails.push(extractNrcFromEmail(emailData));
            });
          });

          fetch.once("error", (err: Error) => {
            imap.end();
            reject({ success: false, error: "Error fetching emails" });
          });

          fetch.once("end", () => {
            imap.end();
            resolve({ success: true, data: emails });
          });
        });
      });
    });

    imap.once("error", (err: Error) => {
      reject({ success: false, error: "Connection error" });
    });

    imap.once("end", () => {
      console.log("Connection ended");
    });

    imap.connect();
  });
};
