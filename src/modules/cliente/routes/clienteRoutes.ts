import { Express, Request, Response, RequestHandler } from "express";
import { logToFile } from "../../dte/utils/logUtils";
import {
  getClientes,
  createCliente,
  updateCliente,
  deleteCliente,
  createClienteFromReceptor,
} from "../services/clienteService";
import { ReceptorDTO } from "../types";

export function setClienteRoutes(app: Express) {
  // Get all clientes
  app.get("/api/clientes", (async (req: Request, res: Response) => {
    try {
      const clientes = await getClientes();
      res.status(200).json({ success: true, data: clientes });
    } catch (error) {
      logToFile(`Error fetching clientes: ${error}`, "error");
      res
        .status(500)
        .json({ success: false, message: "Error fetching clientes" });
    }
  }) as RequestHandler);

  // Create a new cliente from receptor data
  app.post("/api/clientes/receptor", (async (req: Request, res: Response) => {
    try {
      console.log("Received request to create cliente from receptor");
      const receptorData = req.body as ReceptorDTO;

      if (!receptorData.receptor) {
        return res.status(400).json({
          success: false,
          message: "Invalid request format. 'receptor' object is required",
        });
      }

      if (
        !receptorData.receptor.nrc ||
        !receptorData.receptor.nit ||
        !receptorData.receptor.nombre
      ) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: nrc, nit, and nombre are required",
        });
      }

      const newCliente = await createClienteFromReceptor(receptorData);
      res.status(201).json({
        success: true,
        message: "Cliente created successfully",
        data: newCliente,
      });
    } catch (error) {
      logToFile(`Error creating cliente from receptor: ${error}`, "error");
      res.status(500).json({
        success: false,
        message: "Error creating cliente from receptor data",
      });
    }
  }) as RequestHandler);

  // Create a new cliente
  app.post("/api/clientes", (async (req: Request, res: Response) => {
    try {
      const cliente = req.body;
      const newCliente = await createCliente(cliente);
      res.status(201).json({ success: true, data: newCliente });
    } catch (error) {
      logToFile(`Error creating cliente: ${error}`, "error");
      res
        .status(500)
        .json({ success: false, message: "Error creating cliente" });
    }
  }) as RequestHandler);

  // Update a cliente
  app.put("/api/clientes/:id", (async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const cliente = req.body;
      const updatedCliente = await updateCliente(parseInt(id), cliente);
      res.status(200).json({ success: true, data: updatedCliente });
    } catch (error) {
      logToFile(`Error updating cliente: ${error}`, "error");
      res
        .status(500)
        .json({ success: false, message: "Error updating cliente" });
    }
  }) as RequestHandler);

  // Delete a cliente
  app.delete("/api/clientes/:id", (async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await deleteCliente(parseInt(id));
      res
        .status(200)
        .json({ success: true, message: "Cliente deleted successfully" });
    } catch (error) {
      logToFile(`Error deleting cliente: ${error}`, "error");
      res
        .status(500)
        .json({ success: false, message: "Error deleting cliente" });
    }
  }) as RequestHandler);

  // Find cliente by NRC
  app.get("/api/clientes/nrc/:nrc", (async (req: Request, res: Response) => {
    try {
      const { nrc } = req.params;
      const clientes = await getClientes();
      const cliente = clientes.find((c) => c.nrc === nrc);

      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: `Cliente with NRC ${nrc} not found`,
        });
      }

      res.status(200).json({ success: true, data: cliente });
    } catch (error) {
      logToFile(`Error finding cliente by NRC: ${error}`, "error");
      res.status(500).json({
        success: false,
        message: "Error finding cliente by NRC",
      });
    }
  }) as RequestHandler);
}
