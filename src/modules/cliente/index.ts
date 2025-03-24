import { Express } from "express";
import { setClienteRoutes } from "./routes/clienteRoutes";

export function initializeClienteModule(app: Express): void {
  // Initialize all routes for the cliente module
  setClienteRoutes(app);
  console.log("Cliente module initialized");
}

export * from "./types";
