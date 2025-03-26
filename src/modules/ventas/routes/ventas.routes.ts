import { Router } from "express";
import { VentasController } from "../controllers/ventas.controller";

const router = Router();
const ventasController = new VentasController();

// Rutas principales
router.get("/listar", ventasController.listar);
router.post("/crear", ventasController.crear);

// Rutas específicas
router.get("/filtrar/tipo/:tipo", ventasController.filtrarPorTipo);
router.post("/anular/:id", ventasController.anular);

// Rutas con parámetros
router.get("/buscar/:id", ventasController.buscar);
router.put("/actualizar/:id", ventasController.actualizar);
router.delete("/eliminar/:id", ventasController.eliminar);

export default router;
