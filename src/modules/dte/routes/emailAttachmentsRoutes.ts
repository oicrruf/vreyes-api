import { Express, RequestHandler } from "express";
import { sendBuffersViaEmail, BufferAttachment } from "../services/emailService";
import { 
  listFilesInDrivePath, 
  downloadDriveFileToBuffer, 
  deleteDriveFile 
} from "../services/driveService";
import { Parser } from "json2csv";
import { logToFile } from "../utils/logUtils";

export function setEmailAttachmentsRoutes(app: Express) {
  // Endpoint to send current month's files via email entirely from Google Drive
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

      logToFile(`Sending email for ${targetYear}-${targetMonth} to ${recipients.length} recipients: ${recipients.join(", ")}`);

      const driveFolderPath = `dte/${targetYear}/${targetMonth}/compras`;
      
      logToFile(`Listing files in Drive folder: ${driveFolderPath}`);
      const driveFiles = await listFilesInDrivePath(driveFolderPath);

      if (!driveFiles || driveFiles.length === 0) {
        return res.status(404).json({
          success: false,
          error: `No files found in Google Drive for ${targetYear}-${targetMonth} at ${driveFolderPath}`,
        });
      }

      const jsonDriveFiles = driveFiles.filter(f => f.name?.toLowerCase().endsWith(".json") || f.mimeType === "application/json");
      const pdfDriveFiles = driveFiles.filter(f => f.name?.toLowerCase().endsWith(".pdf") || f.mimeType === "application/pdf");

      if (pdfDriveFiles.length === 0) {
        return res.status(404).json({
          success: false,
          error: "No PDF files found to send in Drive",
        });
      }

      logToFile(`Found ${jsonDriveFiles.length} JSON files and ${pdfDriveFiles.length} PDF files in Drive.`);

      const targetNrc = process.env.RECEPTOR_NRC || "2594881";
      const jsonValues = [];
      const buffersToAttach: BufferAttachment[] = [];

      // Process JSON files
      for (const file of jsonDriveFiles) {
        try {
          const buffer = await downloadDriveFileToBuffer(file.id);
          if (!buffer) continue;

          const jsonContent = buffer.toString("utf8");
          const jsonData = JSON.parse(jsonContent);

          if (jsonData?.receptor?.nrc === targetNrc) {
            jsonValues.push({
              Column1: formatDate(jsonData.identificacion?.fecEmi) || "",
              Column2: 1,
              Column3: 3,
              Column4: jsonData.identificacion?.codigoGeneracion?.replace(/-/g, "") || "",
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
          console.error(`Error processing Drive JSON file ${file.name}:`, error);
        }
      }

      // Generate CSV file buffer
      const csvParser = new Parser({
        fields: ["Column1", "Column2", "Column3", "Column4", "Column5", "Column6", "Column7", "Column8", "Column9", "Column10", "Column11", "Column12", "Column13", "Column14", "Column15", "Column16", "Column17", "Column18", "Column19", "Column20", "Column21"],
      });

      const csvContent = csvParser.parse(jsonValues);
      
      const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      const monthName = monthNames[parseInt(targetMonth) - 1];
      const csvFileName = `COMPRAS-${monthName.toUpperCase()}-${targetYear}.csv`;

      // Add CSV buffer to attachments
      buffersToAttach.push({
        filename: csvFileName,
        content: Buffer.from(csvContent, "utf-8"),
      });

      // Download PDFs as buffers and add to attachments
      for (const file of pdfDriveFiles) {
        const buffer = await downloadDriveFileToBuffer(file.id);
        if (buffer) {
          buffersToAttach.push({
            filename: file.name,
            content: buffer,
          });
        }
      }

      // Send email using buffers
      const result = await sendBuffersViaEmail(
        recipients,
        buffersToAttach,
        subject || `${targetYear}-${targetMonth}: CCF de Víctor M. Reyes`,
        message || `Adjunto envío los Comprobantes de Crédito Fiscal correspondientes al mes de ${monthName}.`
      );

      if (result.success) {
        // Delete JSON files from Drive after successful email
        const deletedJsonFiles = [];
        for (const file of jsonDriveFiles) {
          try {
            await deleteDriveFile(file.id);
            deletedJsonFiles.push(file.name);
            logToFile(`Deleted JSON file from Drive: ${file.name}`);
          } catch (error) {
            logToFile(`Error deleting Drive JSON file ${file.name}: ${error}`, "error");
          }
        }

        res.status(200).json({
          success: true,
          message: `Sent ${buffersToAttach.length} files via email to ${recipients.join(", ")}`,
          sentFiles: buffersToAttach.map(f => f.filename),
          deletedJsonFiles,
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
        error: "Failed to process and send files via Drive",
      });
    }
  }) as RequestHandler);
}

const formatDate = (dateString: string): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};
