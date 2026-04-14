import express, { Express } from "express";
import dotenv from "dotenv";
import cors from "cors";
import { setDteRoutes } from "./modules/dte/routes";
import { initializeCronJobs } from "./scheduled/dte";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger";
import { authMiddleware } from "./middleware/authMiddleware";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Configure CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:9000", // Allow requests from our React app
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
};

// Apply CORS middleware
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply auth middleware to all /api routes
app.use("/api", authMiddleware);

// Set up routes
setDteRoutes(app);

// Swagger documentation route
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Add a root route handler
app.get("/", (req, res) => {
  res.status(200).json({ message: "Auto Task API is running" });
});

// Initialize cron jobs
initializeCronJobs();

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
