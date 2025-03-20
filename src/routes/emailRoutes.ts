import { Express, RequestHandler } from "express";
import {
  listCurrentMonthEmails,
  filterEmailsByTerm,
  EmailResponse,
} from "../services/gmailService";
import { sendFilesViaEmail } from "../services/emailService";
import {
  getCurrentMonthPath,
  saveAttachment,
  isJsonAttachment,
  parseJsonAttachment,
} from "../utils/fileUtils";
import path from "path";
import fs from "fs";
import { Parser } from "json2csv";

export function setRoutes(app: Express) {
  // Endpoint to get emails from the current month
  app.get("/api/emails/current-month", (async (req, res) => {
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

        // Process attachments for filtered emails
        filteredEmails.forEach((email) => {
          if (email.attachments && email.attachments.length > 0) {
            let shouldDownloadPdf = false;

            email.attachments.forEach((attachment) => {
              if (isJsonAttachment(attachment)) {
                const jsonData = parseJsonAttachment(attachment);
                if (jsonData?.receptor?.nrc === "2594881") {
                  shouldDownloadPdf = true;
                }
              }
            });

            if (shouldDownloadPdf) {
              email.attachments.forEach((attachment) => {
                if (attachment.filename?.toLowerCase().endsWith(".pdf")) {
                  saveAttachment(attachment); // Save the PDF attachment
                }
              });
            }
          }
        });

        res.status(200).json({
          success: true,
          // data: filteredEmails,
          totalFiltered: filteredEmails.length,
          totalOriginal: result.data.length,
        });
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error("Error in /api/emails/current-month:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }) as RequestHandler);

  // Endpoint to send current month's files via email
  app.post("/api/attachments/dte/email", (async (req, res) => {
    try {
      const { email, fileNames, subject, message } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: "Email address is required",
        });
      }

      const currentPath = getCurrentMonthPath();
      let filesToSend: string[] = [];

      if (!fs.existsSync(currentPath)) {
        fs.mkdirSync(currentPath, { recursive: true });
        return res.status(404).json({
          success: false,
          error: "No files found for the current month",
          path: currentPath,
        });
      }

      if (fileNames && Array.isArray(fileNames) && fileNames.length > 0) {
        filesToSend = fileNames
          .map((filename) => path.join(currentPath, filename))
          .filter((filePath) => fs.existsSync(filePath));
      } else {
        const files = fs
          .readdirSync(currentPath)
          .filter((file) => file.toLowerCase().endsWith(".pdf"));
        filesToSend = files.map((filename) => path.join(currentPath, filename));
      }

      if (filesToSend.length === 0) {
        return res.status(404).json({
          success: false,
          error: "No files found to send",
          path: currentPath,
        });
      }

      // Extract values from JSON attachments and generate CSV
      const jsonValues: Array<{
        Column1: string;
        Column2: number;
        Column3: number;
        Column4: string;
        Column5: string;
        Column6: string;
        Column7: string;
        Column8: number;
        Column9: number;
        Column10: string;
        Column11: number;
        Column12: number;
        Column13: number;
        Column14: string;
        Column15: string;
        Column16: string;
        Column17: number;
        Column18: number;
        Column19: number;
        Column20: number;
        Column21: number;
      }> = [];
      const emails = await listCurrentMonthEmails();
      if (emails.success && emails.data) {
        emails.data.forEach((email) => {
          if (email.attachments && email.attachments.length > 0) {
            let shouldProcessJson = false;

            // Check JSON attachments for the filtering criteria
            email.attachments.forEach((attachment) => {
              if (isJsonAttachment(attachment)) {
                const jsonData = parseJsonAttachment(attachment);
                if (jsonData?.receptor?.nrc === "2594881") {
                  shouldProcessJson = true;
                  jsonValues.push({
                    Column1: formatDate(jsonData.identificacion?.fecEmi) || "",
                    Column2: 1,
                    Column3: 3,
                    Column4:
                      jsonData.identificacion?.codigoGeneracion?.replace(
                        /-/g,
                        ""
                      ) || "",
                    Column5: jsonData.emisor?.nrc || "",
                    Column6: jsonData.emisor?.nombre || "",
                    Column7: jsonData.resumen?.totalExenta || "",
                    Column8: 0,
                    Column9: 0,
                    Column10: jsonData.resumen?.totalGravada || "",
                    Column11: 0,
                    Column12: 0,
                    Column13: 0,
                    Column14: jsonData.resumen?.tributos?.valor || "",
                    Column15: jsonData.resumen?.totalPagar || "",
                    Column16: "",
                    Column17: 1,
                    Column18: 2,
                    Column19: 4,
                    Column20: 2,
                    Column21: 3,
                  });
                }
              }
            });

            // Save PDFs only if the JSON matches the criteria
            if (shouldProcessJson) {
              email.attachments.forEach((attachment) => {
                if (attachment.filename?.toLowerCase().endsWith(".pdf")) {
                  saveAttachment(attachment); // Save the PDF attachment
                }
              });
            }
          }
        });
      }

      const csvParser = new Parser({
        fields: [
          "Column1", // identificacion_fecEmi
          "Column2", // 1
          "Column3", // 3
          "Column4", // identificacion_codigoGeneracion
          "Column5", // emisor_nrc
          "Column6", // emisor_nombre
          "Column7", // resumen_totalExenta
          "Column8", // 0
          "Column9", // 0
          "Column10", // resumen_totalGravada
          "Column11", // 0
          "Column12", // 0
          "Column13", // 0
          "Column14", // resumen_tributos_valor
          "Column15", // resumen_totalPagar
          "Column16", // ''
          "Column17", // 1
          "Column18", // 2
          "Column19", // 4
          "Column20", // 2
          "Column21", // 3
        ],
      });
      const csv = csvParser.parse(jsonValues);

      // Generate the CSV filename
      const csvFileName = `COMPRAS-${getPreviousMonthName().toUpperCase()}-${new Date().getFullYear()}.csv`;
      const csvFilePath = path.join(currentPath, csvFileName);
      fs.writeFileSync(csvFilePath, csv);
      filesToSend.push(csvFilePath);

      const result = await sendFilesViaEmail(
        email,
        filesToSend,
        subject || `${getPreviousYearAndMonth()}: CCF de Víctor M. Reyes`,
        message ||
          `Adjunto envío los Comprobantes de Crédito Fiscal correspondientes al mes de ${getPreviousMonthName()}.`
      );

      if (result.success) {
        res.status(200).json({
          success: true,
          message: `Sent ${filesToSend.length} files via email to ${email}`,
          sentFiles: filesToSend.map((f) => path.basename(f)),
          result,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || "Failed to send email",
        });
      }
    } catch (error) {
      console.error("Error in /api/attachments/dte/email:", error);
      res.status(500).json({
        success: false,
        error: "Failed to send files via email",
      });
    }
  }) as RequestHandler);
}

/**
 * Capitalize the first letter of a string
 */
const capitalizeFirstLetter = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Get the previous year and month in the format "añomes"
 */
const getPreviousYearAndMonth = (): string => {
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1);
  const year = previousMonth.getFullYear();
  const month = (previousMonth.getMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
};

/**
 * Get the name of the previous month in Spanish with the first letter capitalized
 */
const getPreviousMonthName = (): string => {
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1);
  const monthName = previousMonth.toLocaleString("es-ES", { month: "long" });
  return monthName.charAt(0).toUpperCase() + monthName.slice(1);
};

/**
 * Format date as DD/MM/YYYY
 */
const formatDate = (dateString: string): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};
