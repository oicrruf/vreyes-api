import express, { Express } from "express";
import dotenv from "dotenv";
import { setDteRoutes } from "./modules/dte/routes";
import { initializeCronJobs } from "./scheduled/dte";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up routes
setDteRoutes(app);

// Initialize cron jobs
initializeCronJobs();

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
