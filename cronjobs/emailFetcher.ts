import cron from "node-cron";
import axios, { AxiosResponse } from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_URL = process.env.API_URL || "http://localhost:3000";

console.log("Starting email fetcher cronjob...");

// Schedule task to run every day at 23:59 (11:59 PM)
cron.schedule("59 23 * * *", async () => {
  try {
    console.log(
      `[${new Date().toISOString()}] Making request to /api/emails/current-month...`
    );

    const response: AxiosResponse = await axios.post(
      `${API_URL}/api/emails/current-month`
    );

    console.log(
      `[${new Date().toISOString()}] Request completed with status: ${
        response.status
      }`
    );
    console.log(`Processed ${response.data.totalFiltered} emails.`);
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

console.log("Cronjob is running. Press Ctrl+C to exit.");
