import fs from "fs";
import path from "path";

export interface PdfSearchResult {
  filepath: string;
  filename: string;
  found: boolean;
  matchingText?: string[];
}

export const saveAttachment = (
  attachment: any,
  customBasePath?: string
): string => {
  try {
    const basePath =
      customBasePath || process.env.ATTACHMENTS_PATH || "./downloads";

    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");

    const dirPath = path.join(basePath, year, month);

    // Ensure directory exists
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Save the attachment
    const filename = attachment.filename || `attachment_${Date.now()}.pdf`;
    const filepath = path.join(dirPath, filename);
    fs.writeFileSync(filepath, attachment.content);

    return filepath;
  } catch (error) {
    console.error("Error saving attachment:", error);
    return "";
  }
};

export const isPdfAttachment = (attachment: any): boolean => {
  return (
    attachment.contentType === "application/pdf" ||
    (attachment.filename && attachment.filename.toLowerCase().endsWith(".pdf"))
  );
};

export const isJsonAttachment = (attachment: any): boolean => {
  return (
    attachment.contentType === "application/json" ||
    (attachment.filename && attachment.filename.toLowerCase().endsWith(".json"))
  );
};

export const parseJsonAttachment = (attachment: any): any => {
  try {
    const jsonContent = attachment.content.toString("utf-8").trim(); // Trim whitespace
    return JSON.parse(jsonContent);
  } catch (error) {
    const err = error as Error; // Explicitly cast error to Error
    console.error("Error parsing JSON attachment:", err.message);
    console.error(
      "Invalid JSON content:",
      attachment.content.toString("utf-8")
    ); // Log problematic content
    return null; // Return null for invalid JSON
  }
};

export const checkNrcInJson = (jsonData: any, targetNrc: string): boolean => {
  if (!jsonData) return false;

  // Direct check for NRC property
  if (jsonData.nrc && jsonData.nrc === targetNrc) {
    return true;
  }

  // Check for nested properties
  for (const key in jsonData) {
    if (typeof jsonData[key] === "object" && jsonData[key] !== null) {
      // Recursively check nested objects
      if (checkNrcInJson(jsonData[key], targetNrc)) {
        return true;
      }
    }
  }

  return false;
};

export const saveAndSearchPdf = async (
  attachment: any,
  searchTerm?: string,
  basePath: string = process.env.ATTACHMENTS_PATH || "./attachments/"
): Promise<{ filepath: string; searchResult?: PdfSearchResult }> => {
  const savedPath = saveAttachment(attachment, basePath);

  if (!savedPath || !searchTerm) {
    return { filepath: savedPath };
  }

  return { filepath: savedPath };
};

export const getCurrentMonthPath = (): string => {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");

  // Use ATTACHMENTS_PATH from environment variables instead of hardcoded path
  const basePath = process.env.ATTACHMENTS_PATH || "./attachments";

  return path.join(basePath, year, month);
};

export const getPreviousMonthPath = (): string => {
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1);
  const year = previousMonth.getFullYear().toString();
  const month = (previousMonth.getMonth() + 1).toString().padStart(2, "0");
  const basePath = process.env.ATTACHMENTS_PATH || "./downloads";
  return path.join(basePath, year, month);
};

export const listFilesInDirectory = (dirPath: string): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(dirPath)) {
      return resolve([]);
    }

    fs.readdir(dirPath, (err, files) => {
      if (err) {
        reject(err);
        return;
      }

      // Filter out non-PDF files
      const pdfFiles = files.filter((file) =>
        file.toLowerCase().endsWith(".pdf")
      );
      resolve(pdfFiles);
    });
  });
};
