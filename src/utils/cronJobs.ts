import cron from "node-cron";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_URL = process.env.API_URL || "http://localhost:3000";

export const initializeCronJobs = (): void => {
  console.log("Initializing cron jobs...");

  // Current month email fetcher - runs at 11:59 PM every day
  cron.schedule("59 23 * * *", async () => {
    try {
      console.log(
        `[${new Date().toISOString()}] Making request to /api/emails/current-month...`
      );
      const response = await axios.post(`${API_URL}/api/emails/current-month`);
      console.log(
        `[${new Date().toISOString()}] Request completed with status: ${
          response.status
        }`
      );
      console.log(`Processed ${response.data.totalFiltered} emails.`);
    } catch (error: any) {
      console.error(
        `[${new Date().toISOString()}] Error fetching emails:`,
        error.message
      );
    }
  });

  // DTE email sender - runs at 7:00 AM on the 1st day of every month
  cron.schedule("0 7 1 * *", async () => {
    try {
      console.log(
        `[${new Date().toISOString()}] Making request to /api/attachments/dte/email...`
      );

      // Parse comma-separated email addresses
      const recipientEmails = process.env.RECIPIENT_EMAIL
        ? process.env.RECIPIENT_EMAIL.split(",").map((email) => email.trim())
        : ["default@example.com"];

      const body = {
        email: recipientEmails,
      };

      const response = await axios.post(
        `${API_URL}/api/attachments/dte/email`,
        body
      );
      console.log(
        `[${new Date().toISOString()}] Request completed with status: ${
          response.status
        }`
      );
      console.log(
        `Sent ${response.data.sentFiles?.length || 0} files via email.`
      );
    } catch (error: any) {
      console.error(
        `[${new Date().toISOString()}] Error sending DTE email:`,
        error.message
      );

      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      }
    }
  });

  console.log("All cron jobs initialized successfully");
};
