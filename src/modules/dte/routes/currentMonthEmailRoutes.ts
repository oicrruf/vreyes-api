import { Express, RequestHandler } from "express";
import {
  listCurrentMonthEmails,
  EmailResponse,
} from "../services/gmailService";
import {
  isJsonAttachment,
  parseJsonAttachment,
} from "../utils/fileUtils";
import { logToFile } from "../utils/logUtils";
import { uploadBufferToDrive } from "../services/driveService";

export function setCurrentMonthEmailRoutes(app: Express) {
  /**
   * @swagger
   * /api/dte:
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
  app.post("/api/dte", (async (req, res) => {
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

        const now = new Date();
        const yearStr = (year || now.getFullYear()).toString();
        const monthStr = (month || now.getMonth() + 1).toString().padStart(2, "0");
        const driveFolderPath = `dte/${yearStr}/${monthStr}/compras`;

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

        // Use for...of loop instead of forEach to handle async/await
        for (const email of filteredEmails) {
          if (email.attachments && email.attachments.length > 0) {
            let shouldDownloadAttachments = false;
            let jsonAttachment: any = null;

            // First, check if any JSON attachment meets the criteria
            email.attachments.forEach((attachment: any) => {
              if (isJsonAttachment(attachment)) {
                logToFile(`Found JSON attachment in email: ${email.subject}`);
                const jsonData = parseJsonAttachment(attachment);
                if (jsonData?.receptor?.nrc === targetNrc) {
                  logToFile(`JSON matches criteria: receptor.nrc = ${jsonData.receptor.nrc}`);
                  shouldDownloadAttachments = true;
                  jsonAttachment = attachment;
                }
              }
            });

            // If criteria is met, upload both JSON and PDF attachments to Drive
            if (shouldDownloadAttachments && jsonAttachment) {
              const uniqueEmailId = email.uid;
              let jsonFilename = jsonAttachment.filename || `data_${uniqueEmailId}.json`;

              logToFile(`Uploading JSON attachment from email: ${email.subject} to Drive`);
              try {
                const driveId = await uploadBufferToDrive(
                  jsonFilename, 
                  jsonAttachment.content, 
                  jsonAttachment.contentType || "application/json", 
                  driveFolderPath
                );
                if (driveId) logToFile(`Uploaded JSON to Drive: ${driveId}`);
              } catch (e) {
                logToFile(`Failed to upload JSON: ${e}`, "error");
              }

              const pdfFilenames: string[] = [];

              for (const attachment of email.attachments) {
                if (attachment.filename?.toLowerCase().endsWith(".pdf")) {
                  const pdfFilename = attachment.filename;
                  logToFile(`Uploading PDF attachment: ${pdfFilename} to Drive`);
                  pdfFilenames.push(pdfFilename);

                  try {
                    const driveId = await uploadBufferToDrive(
                      pdfFilename, 
                      attachment.content, 
                      "application/pdf", 
                      driveFolderPath
                    );
                    if (driveId) logToFile(`Uploaded PDF to Drive: ${driveId}`);
                  } catch (e) {
                    logToFile(`Failed to upload PDF: ${e}`, "error");
                  }
                }
              }

              if (jsonFilename) {
                if (pdfFilenames.length > 0) {
                  pdfFilenames.forEach((pdfFilename) => {
                    downloadedFiles.push({ id: uniqueEmailId, json: jsonFilename, pdf: pdfFilename });
                  });
                } else {
                  downloadedFiles.push({ id: uniqueEmailId, json: jsonFilename });
                }
              }
            }
          }
        }

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
