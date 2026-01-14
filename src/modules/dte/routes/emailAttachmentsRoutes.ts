import { Express, RequestHandler } from "express";
import { sendFilesViaEmail } from "../services/emailService";
import path from "path";
import fs from "fs";
import { Parser } from "json2csv";
import { logToFile } from "../utils/logUtils";

export function setEmailAttachmentsRoutes(app: Express) {
  // Endpoint to send current month's files via email
  app.post("/api/attachments/dte/email", (async (req, res) => {
    try {
      const { subject, message, year, month } = req.body;

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

      // Determine target year and month
      let targetYear, targetMonth;
      if (year && month) {
        targetYear = year.toString();
        targetMonth = month.toString().padStart(2, "0");
      } else {
        // Default to previous month
        const now = new Date();
        const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1);
        targetYear = previousMonth.getFullYear().toString();
        targetMonth = (previousMonth.getMonth() + 1).toString().padStart(2, "0");
      }

      // Log recipients for debugging
      logToFile(
        `Sending email for ${targetYear}-${targetMonth} to ${recipients.length} recipients: ${recipients.join(
          ", "
        )}`
      );

      // Base attachments path
      const basePath = process.env.ATTACHMENTS_PATH || "./attachments";

      // Paths for compras and ventas
      const comprasPath = path.join(basePath, targetYear, targetMonth, "compras");
      const ventasPath = path.join(basePath, targetYear, targetMonth, "ventas");

      // Check if compras folder exists (it's the main one)
      if (!fs.existsSync(comprasPath)) {
        return res.status(404).json({
          success: false,
          error: `No 'compras' folder found for ${targetYear}-${targetMonth}`,
          path: comprasPath,
        });
      }

      // Helper to valid PDF files
      const getPdfFiles = (dir: string) => {
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir)
          .filter(file => file.toLowerCase().endsWith(".pdf"))
          .map(filename => path.join(dir, filename));
      }

      // Get PDF files from both folders
      const comprasPdfs = getPdfFiles(comprasPath);
      const ventasPdfs = getPdfFiles(ventasPath);
      const allPdfFiles = [...comprasPdfs, ...ventasPdfs];

      // Get JSON files ONLY from compras for CSV
      const jsonFiles = fs
        .readdirSync(comprasPath)
        .filter((file) => file.toLowerCase().endsWith(".json"))
        .map((filename) => path.join(comprasPath, filename));

      if (allPdfFiles.length === 0) {
        return res.status(404).json({
          success: false,
          error: "No PDF files found to send (checked compras and ventas)",
          path: `${comprasPath} & ${ventasPath}`,
        });
      }

      logToFile(
        `Found ${jsonFiles.length} JSON files (compras), ${comprasPdfs.length} PDF files (compras) and ${ventasPdfs.length} PDF files (ventas)`
      );

      // Process JSON files to generate CSV
      const jsonValues = [];
      // Get NRC from environment variable with fallback to default
      const targetNrc = process.env.RECEPTOR_NRC || "2594881";

      for (const jsonFile of jsonFiles) {
        try {
          const jsonContent = fs.readFileSync(jsonFile, "utf8");
          const jsonData = JSON.parse(jsonContent);

          // Check if receptor.nrc matches criteria
          if (jsonData?.receptor?.nrc === targetNrc) {
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

      // Determine file name based on target month
      const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      const monthName = monthNames[parseInt(targetMonth) - 1]; // targetMonth is 1-based string

      const csvFileName = `COMPRAS-${monthName.toUpperCase()}-${targetYear}.csv`;

      // Save CSV in compras path
      const csvFilePath = path.join(comprasPath, csvFileName);
      fs.writeFileSync(csvFilePath, csv);

      // Files to send (All PDFs and CSV)
      const filesToSend = [...allPdfFiles, csvFilePath];

      // Send email using recipients from environment variable
      const result = await sendFilesViaEmail(
        recipients,
        filesToSend,
        subject || `${targetYear}-${targetMonth}: CCF de Víctor M. Reyes`,
        message ||
        `Adjunto envío los Comprobantes de Crédito Fiscal correspondientes al mes de ${monthName}.`
      );

      if (result.success) {
        // Delete JSON files after successful email
        for (const jsonFile of jsonFiles) {
          try {
            fs.unlinkSync(jsonFile);
            logToFile(`Deleted JSON file: ${jsonFile}`);
          } catch (error) {
            logToFile(
              `Error deleting JSON file ${jsonFile}: ${error}`,
              "error"
            );
          }
        }

        res.status(200).json({
          success: true,
          message: `Sent ${filesToSend.length
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
      logToFile(`Error in /api/attachments/dte/email: ${error}`, "error");
      res.status(500).json({
        success: false,
        error: "Failed to send files via email",
      });
    }
  }) as RequestHandler);
}

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
