import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export interface EmailResponse {
  success: boolean;
  message?: string;
  error?: string;
  messageId?: string;
}

export interface BufferAttachment {
  filename: string;
  content: Buffer;
}

/**
 * Send buffers via email
 */
export const sendBuffersViaEmail = async (
  to: string | string[],
  buffers: BufferAttachment[],
  subject: string = `${getPreviousMonthName()}: CCF Víctor M. Reyes`,
  text: string = `Adjunto envío los Comprobantes de Crédito Fiscal correspondientes al mes de ${getPreviousMonthName()}.`
): Promise<EmailResponse> => {
  try {
    const recipients = Array.isArray(to) ? to.join(",") : to;
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    if (!buffers || buffers.length === 0) {
      return { success: false, error: "No buffer files provided to attach" };
    }

    const info = await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: recipients,
      cc: process.env.GMAIL_USER,
      subject,
      text,
      attachments: buffers,
    });

    return {
      success: true,
      message: "Email sent successfully with buffers",
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Error sending email with buffers:", error);
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
