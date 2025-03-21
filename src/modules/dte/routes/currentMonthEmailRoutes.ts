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

        console.log(
          `Found ${filteredEmails.length} emails with "Documento Tributario" in subject`
        );

        // Process and save attachments for filtered emails
        let downloadedFiles = {
          json: [] as string[],
          pdf: [] as string[],
        };

        filteredEmails.forEach((email) => {
          if (email.attachments && email.attachments.length > 0) {
            let shouldDownloadAttachments = false;
            let jsonAttachment = null;

            // First, check if any JSON attachment meets the criteria
            email.attachments.forEach((attachment) => {
              if (isJsonAttachment(attachment)) {
                console.log(`Found JSON attachment in email: ${email.subject}`);
                const jsonData = parseJsonAttachment(attachment);
                if (jsonData?.receptor?.nrc === "2594881") {
                  console.log(
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
              console.log(
                `Saving JSON attachment from email: ${email.subject}`
              );
              const savedJsonPath = saveAttachment(jsonAttachment);
              if (savedJsonPath) {
                console.log(`JSON attachment saved to: ${savedJsonPath}`);
                downloadedFiles.json.push(savedJsonPath);
              }

              // Save any PDF attachments from the same email
              email.attachments.forEach((attachment) => {
                if (attachment.filename?.toLowerCase().endsWith(".pdf")) {
                  console.log(`Saving PDF attachment: ${attachment.filename}`);
                  const savedPath = saveAttachment(attachment);
                  if (savedPath) {
                    console.log(`PDF attachment saved to: ${savedPath}`);
                    downloadedFiles.pdf.push(savedPath);
                  }
                }
              });
            }
          }
        });

        res.status(200).json({
          success: true,
          totalFiltered: filteredEmails.length,
          totalOriginal: result.data.length,
          downloadedFiles: downloadedFiles,
        });
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error("Error in /api/emails/current-month:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }) as RequestHandler);
}
