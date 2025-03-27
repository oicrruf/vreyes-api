import { Request, Response, NextFunction } from "express";
// Import models - adjust these paths to match your actual project structure
import Cliente from "../../cliente/models/cliente.model";
import Venta from "../../ventas/models/venta.model";

export class DashboardController {
  getDashboardData = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Query all customers from database
      const customers = await Cliente.find();

      // Query all sales from database
      const sales = await Venta.find();

      res.status(200).json({
        success: true,
        data: {
          customerCount: customers.length,
          salesCount: sales.length,
        },
        message: "Dashboard data retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  };
}

export const dashboardController = new DashboardController();
