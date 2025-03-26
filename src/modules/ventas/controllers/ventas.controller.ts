import { Request, Response } from "express";
import { VentasService } from "../services/ventas.service";
import { CreateVentaDto } from "../dto/create-venta.dto";
import { UpdateVentaDto } from "../dto/update-venta.dto";

export class VentasController {
  private ventasService: VentasService;

  constructor() {
    this.ventasService = new VentasService();
  }

  crear = async (req: Request, res: Response): Promise<void> => {
    try {
      const ventaData: CreateVentaDto = req.body;
      const nuevaVenta = await this.ventasService.crear(ventaData);
      res.status(201).json({
        success: true,
        message: "Venta creada exitosamente",
        data: nuevaVenta,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Error al crear la venta",
        error: error.message,
      });
    }
  };

  listar = async (_req: Request, res: Response): Promise<void> => {
    try {
      const ventas = await this.ventasService.listarTodos();
      res.status(200).json({
        success: true,
        message: "Ventas recuperadas exitosamente",
        data: ventas,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Error al recuperar las ventas",
        error: error.message,
      });
    }
  };

  buscar = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const venta = await this.ventasService.buscarPorId(id);

      if (!venta) {
        res.status(404).json({
          success: false,
          message: `Venta con ID ${id} no encontrada`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Venta encontrada",
        data: venta,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Error al buscar la venta",
        error: error.message,
      });
    }
  };

  filtrarPorTipo = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tipo } = req.params;

      if (tipo !== "FACTURA" && tipo !== "CCF") {
        res.status(400).json({
          success: false,
          message: "Tipo de documento inválido. Debe ser FACTURA o CCF",
        });
        return;
      }

      const ventas = await this.ventasService.filtrarPorTipo(tipo);
      res.status(200).json({
        success: true,
        message: `Ventas de tipo ${tipo} recuperadas exitosamente`,
        data: ventas,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Error al filtrar ventas por tipo",
        error: error.message,
      });
    }
  };

  actualizar = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const ventaData: UpdateVentaDto = req.body;

      const ventaActualizada = await this.ventasService.actualizar(
        id,
        ventaData
      );

      if (!ventaActualizada) {
        res.status(404).json({
          success: false,
          message: `Venta con ID ${id} no encontrada`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Venta actualizada exitosamente",
        data: ventaActualizada,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Error al actualizar la venta",
        error: error.message,
      });
    }
  };

  anular = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const ventaAnulada = await this.ventasService.anular(id);

      if (!ventaAnulada) {
        res.status(404).json({
          success: false,
          message: `Venta con ID ${id} no encontrada`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Venta anulada exitosamente",
        data: ventaAnulada,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Error al anular la venta",
        error: error.message,
      });
    }
  };

  eliminar = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const ventaEliminada = await this.ventasService.eliminar(id);

      if (!ventaEliminada) {
        res.status(404).json({
          success: false,
          message: `Venta con ID ${id} no encontrada`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Venta eliminada exitosamente",
        data: ventaEliminada,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Error al eliminar la venta",
        error: error.message,
      });
    }
  };
}
