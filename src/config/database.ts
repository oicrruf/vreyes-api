import mongoose from "mongoose";
import { logToFile } from "../modules/dte/utils/logUtils";

export const connectToDatabase = async (): Promise<void> => {
  try {
    const MONGODB_URL = process.env.MONGODB_URL;

    if (!MONGODB_URL) {
      throw new Error("MONGODB_URL environment variable is not defined");
    }

    // Configuración de opciones de conexión
    const options = {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000, // Timeout de 5 segundos para la selección del servidor
      socketTimeoutMS: 45000, // Timeout de 45 segundos para las operaciones
    };

    // Conectar a MongoDB
    await mongoose.connect(MONGODB_URL, options);

    logToFile("Successfully connected to MongoDB");

    // Manejar eventos de conexión
    mongoose.connection.on("error", (error: Error) => {
      logToFile(`MongoDB connection error: ${error}`, "error");
    });

    mongoose.connection.on("disconnected", () => {
      logToFile("MongoDB disconnected", "info");
    });

    // Manejar señales de cierre de la aplicación
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      logToFile("MongoDB connection closed due to app termination");
      process.exit(0);
    });
  } catch (error: any) {
    logToFile(`Failed to connect to MongoDB: ${error}`, "error");
    throw error;
  }
};
