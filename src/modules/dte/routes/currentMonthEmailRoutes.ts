import { Express, RequestHandler } from "express";
import {
  listCurrentMonthEmails,
  EmailResponse,
} from "../services/gmailService";
import {
  saveAttachment,
  isJsonAttachment,
  parseJsonAttachment,
} from "../utils/fileUtils";
import { logToFile } from "../utils/logUtils";

export function setCurrentMonthEmailRoutes(app: Express) {
  // Endpoint to get emails from the current month
  app.post("/api/emails/current-month", (async (req, res) => {
    try {
      const result: EmailResponse = await listCurrentMonthEmails();

      if (result.success && result.data) {
        // Filter emails with "Documento Tributario" in the subject (case-insensitive)
        const filteredEmails = result.data.filter(
          (email) =>
            email.subject &&
            email.subject
              .toLowerCase()
              .includes("documento tributario".toLowerCase())
        );

        // Log to file instead of console
        logToFile(
          `Found ${filteredEmails.length} emails with "Documento Tributario" in subject`
        );

        // Process and save attachments for filtered emails
        let downloadedFiles = {
          json: [] as string[],
          pdf: [] as string[],
        };

        // Get NRC from environment variable with fallback to default
        const targetNrc = process.env.RECEPTOR_NRC || "2594881";

        filteredEmails.forEach((email) => {
          if (email.attachments && email.attachments.length > 0) {
            let shouldDownloadAttachments = false;
            let jsonAttachment = null;

            // First, check if any JSON attachment meets the criteria
            email.attachments.forEach((attachment) => {
              if (isJsonAttachment(attachment)) {
                logToFile(`Found JSON attachment in email: ${email.subject}`);
                const jsonData = parseJsonAttachment(attachment);
                if (jsonData?.receptor?.nrc === targetNrc) {
                  logToFile(
                    `JSON matches criteria: receptor.nrc = ${jsonData.receptor.nrc}`
                  );
                  shouldDownloadAttachments = true;
                  jsonAttachment = attachment;
                }
              }
            });

            // If criteria is met, download both JSON and PDF attachments
            if (shouldDownloadAttachments && jsonAttachment) {
              // Save the JSON attachment directly to the month directory
              logToFile(`Saving JSON attachment from email: ${email.subject}`);
              const savedJsonPath = saveAttachment(jsonAttachment);
              if (savedJsonPath) {
                logToFile(`JSON attachment saved to: ${savedJsonPath}`);
                downloadedFiles.json.push(savedJsonPath);
              }

              // Save any PDF attachments from the same email
              email.attachments.forEach((attachment) => {
                if (attachment.filename?.toLowerCase().endsWith(".pdf")) {
                  logToFile(`Saving PDF attachment: ${attachment.filename}`);
                  const savedPath = saveAttachment(attachment);
                  if (savedPath) {
                    logToFile(`PDF attachment saved to: ${savedPath}`);
                    downloadedFiles.pdf.push(savedPath);
                  }
                }
              });
            }
          }
        });

        // Log the response details to file instead of console
        const responseDetails = {
          success: true,
          totalFiltered: filteredEmails.length,
          totalOriginal: result.data.length,
          downloadedFiles: downloadedFiles,
        };

        // Send only a simple success message in the response
        res.status(200).json({
          success: true,
          message: `Processed ${filteredEmails.length} emails. Downloaded ${downloadedFiles.json.length} JSON and ${downloadedFiles.pdf.length} PDF files.`,
          details: responseDetails,
        });
      } else {
        logToFile(result, "error");
        res
          .status(500)
          .json({ success: false, message: "Failed to fetch emails" });
      }
    } catch (error) {
      logToFile(`Error in /api/emails/current-month: ${error}`, "error");
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }) as RequestHandler);
}
