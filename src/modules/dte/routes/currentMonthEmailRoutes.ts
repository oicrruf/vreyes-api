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
  /**
   * @swagger
   * /api/emails/current-month:
   *   post:
   *     summary: Obtiene correos del mes especificado y descarga adjuntos (DTE).
   *     tags: [Emails]
   *     parameters:
   *       - in: query
   *         name: year
   *         schema:
   *           type: integer
   *         description: Año a consultar (ej. 2026). Si se omite, usa el año actual.
   *       - in: query
   *         name: month
   *         schema:
   *           type: integer
   *         description: Mes a consultar (1-12). Si se omite, usa el mes actual.
   *     responses:
   *       200:
   *         description: Correos procesados con éxito.
   *       400:
   *         description: Parámetros inválidos.
   *       500:
   *         description: Error interno o de configuración (RECEPTOR_NRC faltante).
   */
  // Endpoint to get emails from the current month
  app.post("/api/emails/current-month", (async (req, res) => {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;

      // Validate month if provided
      if (month && (month < 1 || month > 12)) {
        return res.status(400).json({ success: false, message: "Month must be between 1 and 12" });
      }

      logToFile(`Fetching emails for date range: Year=${year || "current"}, Month=${month || "current"}`);

      const result: EmailResponse = await listCurrentMonthEmails(year, month);

      if (result.success && result.data) {
        // We no longer filter by subject "Documento Tributario"
        // We process all emails in the range, relying on NRC to filter attachments
        const filteredEmails = result.data;

        // Log to file instead of console
        logToFile(
          `Found ${filteredEmails.length} emails in the specified date range`
        );

        // Process and save attachments for filtered emails
        let downloadedFiles: Array<{
          id: number;
          pdf?: string;
          json?: string;
        }> = [];

        // Get NRC from environment variable without fallback
        const targetNrc = process.env.RECEPTOR_NRC;

        if (!targetNrc) {
          logToFile(
            "Error: RECEPTOR_NRC environment variable is not set",
            "error"
          );
          return res.status(500).json({
            success: false,
            message:
              "Configuration error: RECEPTOR_NRC environment variable is not set",
          });
        }

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
              // Use email.uid instead of generating a unique ID
              const uniqueEmailId = email.uid;

              // Save the JSON attachment directly to the month directory
              logToFile(`Saving JSON attachment from email: ${email.subject}`);
              // Pass year and month to saveAttachment
              const savedJsonPath = saveAttachment(jsonAttachment, undefined, year, month);
              let jsonFilename: string | undefined = undefined;

              if (savedJsonPath) {
                logToFile(`JSON attachment saved to: ${savedJsonPath}`);
                // Extract just the filename from the path
                jsonFilename = savedJsonPath.split("/").pop() || savedJsonPath;
              }

              // Array to collect PDF filenames
              const pdfFilenames: string[] = [];

              // Save any PDF attachments from the same email
              email.attachments.forEach((attachment) => {
                if (attachment.filename?.toLowerCase().endsWith(".pdf")) {
                  logToFile(`Saving PDF attachment: ${attachment.filename}`);
                  // Pass year and month to saveAttachment
                  const savedPath = saveAttachment(attachment, undefined, year, month);
                  if (savedPath) {
                    logToFile(`PDF attachment saved to: ${savedPath}`);
                    // Extract just the filename from the path
                    const pdfFilename = savedPath.split("/").pop() || savedPath;
                    pdfFilenames.push(pdfFilename);
                  }
                }
              });

              // If we have a JSON file, create entries for each PDF or just one entry with the JSON
              if (jsonFilename) {
                if (pdfFilenames.length > 0) {
                  // Create an entry for each PDF file paired with the JSON
                  pdfFilenames.forEach((pdfFilename) => {
                    downloadedFiles.push({
                      id: uniqueEmailId,
                      json: jsonFilename,
                      pdf: pdfFilename,
                    });
                  });
                } else {
                  // Create an entry with just the JSON
                  downloadedFiles.push({
                    id: uniqueEmailId,
                    json: jsonFilename,
                  });
                }
              }
            }
          }
        });

        // Send only a simple success message in the response
        res.status(200).json({
          success: true,
          message: `Processed ${filteredEmails.length} emails. Downloaded ${downloadedFiles.length} files.`,
          detail: {
            original: result.data.length,
            filtered: filteredEmails.length,
            downloaded: downloadedFiles,
          },
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
