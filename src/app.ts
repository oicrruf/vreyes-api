import express, { Express } from "express";
import dotenv from "dotenv";
import { setDteRoutes } from "./modules/dte/routes";
import { initializeCronJobs } from "./scheduled/dte";
import { initializeClienteModule } from "./modules/cliente";
import { connectToDatabase } from "./config/database";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up routes
setDteRoutes(app);

// Initialize modules
initializeClienteModule(app);

// Initialize cron jobs
initializeCronJobs();

// Conectar a la base de datos antes de iniciar el servidor
const startServer = async () => {
  try {
    await connectToDatabase();

    // Iniciar el servidor después de conectar a la base de datos
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
