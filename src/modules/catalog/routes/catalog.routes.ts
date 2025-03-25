import express, { Router } from "express";
const router: Router = express.Router();
import * as catalogController from "../controllers/catalog.controller";

// Rutas para departamentos
router.get("/departamentos", catalogController.getDepartments);
router.get("/departamentos/:id", catalogController.getDepartmentById);

// Rutas para municipios
router.get("/municipios", catalogController.getMunicipalities);
router.get("/municipios/:id", catalogController.getMunicipalityById);

// Rutas para distritos
router.get("/distritos", catalogController.getDistricts);
router.get("/distritos/:id", catalogController.getDistrictById);

export default router;
