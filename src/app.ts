import express, { Express } from "express";
import dotenv from "dotenv";
import { setDteRoutes } from "./modules/dte/routes";
import { initializeCronJobs } from "./scheduled/dte";
import { initializeClienteModule } from "./modules/cliente";
import { connectToDatabase } from "./config/database";
import catalogRouter from "./modules/catalog/routes/catalog.routes";
import ventasRoutes from "./modules/ventas/routes/ventas.routes";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import models in correct order - Cliente before Venta
import "./modules/cliente/models/cliente.model";
import "./modules/ventas/models/venta.model";

// Set up routes
setDteRoutes(app);

// Inicialización de rutas
app.use("/api", catalogRouter);
app.use("/api/ventas", ventasRoutes);

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
