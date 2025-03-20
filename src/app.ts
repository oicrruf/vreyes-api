import express, { Express } from "express";
import dotenv from "dotenv";
import { setRoutes } from "./routes/emailRoutes";
import { initializeCronJobs } from "./utils/cronJobs";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up routes
setRoutes(app);

// Initialize cron jobs
initializeCronJobs();

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
