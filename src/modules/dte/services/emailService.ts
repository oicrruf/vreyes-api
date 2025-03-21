import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

export interface EmailResponse {
  success: boolean;
  message?: string;
  error?: string;
  messageId?: string;
}

/**
 * Send files via email
 */
export const sendFilesViaEmail = async (
  to: string | string[], // Accept a single email or an array of emails
  filePaths: string[],
  subject: string = `${getPreviousMonthName()}: CCF Víctor M. Reyes`,
  text: string = `Adjunto envío los Comprobantes de Crédito Fiscal correspondientes al mes de ${getPreviousMonthName()}.`
): Promise<EmailResponse> => {
  try {
    // Ensure `to` is a comma-separated string if it's an array
    const recipients = Array.isArray(to) ? to.join(",") : to;

    // Create transporter using Gmail credentials
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    // Validate files
    const validFilePaths = filePaths.filter((filePath) =>
      fs.existsSync(filePath)
    );

    if (validFilePaths.length === 0) {
      return {
        success: false,
        error: "No valid files found to attach",
      };
    }

    // Prepare attachments
    const attachments = validFilePaths.map((filePath) => ({
      filename: path.basename(filePath),
      path: filePath,
    }));

    // Send email
    const info = await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: recipients, // Use the recipients string
      cc: process.env.GMAIL_USER, // Add CC to GMAIL_USER
      subject,
      text,
      attachments,
    });

    return {
      success: true,
      message: "Email sent successfully",
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Error sending email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
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
