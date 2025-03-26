import { IVenta } from "../interfaces/venta.interface";
import venta from "../models/venta.model";
import { CreateVentaDto } from "../dto/create-venta.dto";
import { UpdateVentaDto } from "../dto/update-venta.dto";

export class VentasService {
  async crear(ventaData: CreateVentaDto): Promise<IVenta> {
    const nuevaVenta = new venta(ventaData);
    return await nuevaVenta.save();
  }

  async listarTodos(): Promise<IVenta[]> {
    return await venta.find().populate("clienteId", "nombre documento");
  }

  async buscarPorId(id: string): Promise<IVenta | null> {
    return await venta.findById(id).populate("clienteId", "nombre documento");
  }

  async filtrarPorTipo(tipo: string): Promise<IVenta[]> {
    return await venta.find({ tipo }).populate("clienteId", "nombre documento");
  }

  async actualizar(
    id: string,
    ventaData: UpdateVentaDto
  ): Promise<IVenta | null> {
    return await venta.findByIdAndUpdate(id, ventaData, { new: true });
  }

  async anular(id: string): Promise<IVenta | null> {
    return await venta.findByIdAndUpdate(
      id,
      { estado: "ANULADO" },
      { new: true }
    );
  }

  async eliminar(id: string): Promise<IVenta | null> {
    return await venta.findByIdAndDelete(id);
  }
}
