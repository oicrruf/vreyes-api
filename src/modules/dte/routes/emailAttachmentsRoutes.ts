import { Express, RequestHandler } from "express";
import { sendFilesViaEmail } from "../services/emailService";
import { getPreviousMonthPath } from "../utils/fileUtils";
import path from "path";
import fs from "fs";
import { Parser } from "json2csv";

export function setEmailAttachmentsRoutes(app: Express) {
  // Endpoint to send current month's files via email
  app.post("/api/attachments/dte/email", (async (req, res) => {
    try {
      const { subject, message } = req.body;

      // Parse recipients from environment variable
      const recipients = process.env.RECIPIENT_EMAIL
        ? process.env.RECIPIENT_EMAIL.split(",").map((email) => email.trim())
        : [];

      if (recipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No recipients found in RECIPIENT_EMAIL environment variable",
        });
      }

      // Log recipients for debugging
      console.log(
        `Sending email to ${recipients.length} recipients: ${recipients.join(
          ", "
        )}`
      );

      // Use previous month's path instead of current month
      const previousMonthPath = getPreviousMonthPath();
      if (!fs.existsSync(previousMonthPath)) {
        fs.mkdirSync(previousMonthPath, { recursive: true });
        return res.status(404).json({
          success: false,
          error: "No files found for the previous month",
          path: previousMonthPath,
        });
      }

      // Get all PDF files from previous month
      const pdfFiles = fs
        .readdirSync(previousMonthPath)
        .filter((file) => file.toLowerCase().endsWith(".pdf"))
        .map((filename) => path.join(previousMonthPath, filename));

      // Get all JSON files from previous month
      const jsonFiles = fs
        .readdirSync(previousMonthPath)
        .filter((file) => file.toLowerCase().endsWith(".json"))
        .map((filename) => path.join(previousMonthPath, filename));

      if (pdfFiles.length === 0) {
        return res.status(404).json({
          success: false,
          error: "No PDF files found to send for the previous month",
          path: previousMonthPath,
        });
      }

      console.log(
        `Found ${jsonFiles.length} JSON files and ${pdfFiles.length} PDF files for the previous month`
      );

      // Process JSON files to generate CSV
      const jsonValues = [];

      for (const jsonFile of jsonFiles) {
        try {
          const jsonContent = fs.readFileSync(jsonFile, "utf8");
          const jsonData = JSON.parse(jsonContent);

          // Check if receptor.nrc matches criteria
          if (jsonData?.receptor?.nrc === "2594881") {
            jsonValues.push({
              Column1: formatDate(jsonData.identificacion?.fecEmi) || "",
              Column2: 1,
              Column3: 3,
              Column4:
                jsonData.identificacion?.codigoGeneracion?.replace(/-/g, "") ||
                "",
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
        } catch (error) {
          console.error(`Error processing JSON file ${jsonFile}:`, error);
        }
      }

      // Generate the CSV file
      const csvParser = new Parser({
        fields: [
          "Column1",
          "Column2",
          "Column3",
          "Column4",
          "Column5",
          "Column6",
          "Column7",
          "Column8",
          "Column9",
          "Column10",
          "Column11",
          "Column12",
          "Column13",
          "Column14",
          "Column15",
          "Column16",
          "Column17",
          "Column18",
          "Column19",
          "Column20",
          "Column21",
        ],
      });

      const csv = csvParser.parse(jsonValues);
      const csvFileName = `COMPRAS-${getPreviousMonthName().toUpperCase()}-${new Date().getFullYear()}.csv`;
      const csvFilePath = path.join(previousMonthPath, csvFileName);
      fs.writeFileSync(csvFilePath, csv);

      // Files to send (PDF files and CSV)
      const filesToSend = [...pdfFiles, csvFilePath];

      // Send email using recipients from environment variable
      const result = await sendFilesViaEmail(
        recipients,
        filesToSend,
        subject || `${getPreviousYearAndMonth()}: CCF de Víctor M. Reyes`,
        message ||
          `Adjunto envío los Comprobantes de Crédito Fiscal correspondientes al mes de ${getPreviousMonthName()}.`
      );

      if (result.success) {
        // Delete JSON files after successful email
        for (const jsonFile of jsonFiles) {
          try {
            fs.unlinkSync(jsonFile);
            console.log(`Deleted JSON file: ${jsonFile}`);
          } catch (error) {
            console.error(`Error deleting JSON file ${jsonFile}:`, error);
          }
        }

        res.status(200).json({
          success: true,
          message: `Sent ${
            filesToSend.length
          } files via email to ${recipients.join(", ")}`,
          sentFiles: filesToSend.map((f) => path.basename(f)),
          deletedJsonFiles: jsonFiles.map((f) => path.basename(f)),
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
