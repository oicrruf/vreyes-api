import cron from "node-cron";
import axios, { AxiosResponse } from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_URL = process.env.API_URL || "http://localhost:3000";

console.log("Starting DTE email sender cronjob...");

// Schedule task to run on the 1st day of each month at 7:00 AM
cron.schedule("0 7 1 * *", async () => {
  try {
    console.log(
      `[${new Date().toISOString()}] Making request to /api/attachments/dte/email...`
    );

    // Request body with email address from environment variable
    const body = {
      email: process.env.RECIPIENT_EMAIL || "default@example.com",
    };

    const response: AxiosResponse = await axios.post(
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
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error making request:`,
      error.message
    );

    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
  }
});

console.log("DTE email sender cronjob is running. Press Ctrl+C to exit.");
