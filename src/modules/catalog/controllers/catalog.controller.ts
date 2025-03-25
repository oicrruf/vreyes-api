import { Request, Response } from "express";
import DepartmentModel from "../models/departamento.model";
import MunicipalityModel from "../models/municipio.model";
import DistrictModel from "../models/distrito.model";

export const getDepartments = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const departments = await DepartmentModel.find();
    res.status(200).json({
      message: "Departamentos obtenidos correctamente",
      data: departments,
    });
  } catch (error) {
    console.error("Error al obtener departamentos:", error);
    res.status(500).json({ error: "Error al obtener departamentos" });
  }
};

export const getDepartmentById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const department = await DepartmentModel.findById(id);

    if (!department) {
      res.status(404).json({ error: "Departamento no encontrado" });
      return;
    }

    res.status(200).json({
      message: "Departamento obtenido correctamente",
      data: department,
    });
  } catch (error) {
    console.error(
      `Error al obtener departamento con ID ${req.params.id}:`,
      error
    );
    res.status(500).json({ error: "Error al obtener departamento" });
  }
};

export const getMunicipalities = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // const { departmentId } = req.params;
    const municipalities = await MunicipalityModel.find(); // { departmentId }

    res.status(200).json({
      message: "Municipios obtenidos correctamente",
      data: municipalities,
    });
  } catch (error) {
    console.error(
      `Error al obtener municipios del departamento ${req.params.departmentId}:`,
      error
    );
    res.status(500).json({ error: "Error al obtener municipios" });
  }
};

export const getMunicipalityById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const municipality = await MunicipalityModel.findById(id);

    if (!municipality) {
      res.status(404).json({ error: "Municipio no encontrado" });
      return;
    }

    res.status(200).json({
      message: "Municipio obtenido correctamente",
      data: municipality,
    });
  } catch (error) {
    console.error(`Error al obtener municipio con ID ${req.params.id}:`, error);
    res.status(500).json({ error: "Error al obtener municipio" });
  }
};

export const getDistricts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // const { municipalityId } = req.params;
    const districts = await DistrictModel.find(); // { municipalityId }

    res.status(200).json({
      message: "Distritos obtenidos correctamente",
      data: districts,
    });
  } catch (error) {
    console.error(
      `Error al obtener distritos del municipio ${req.params.municipalityId}:`,
      error
    );
    res.status(500).json({ error: "Error al obtener distritos" });
  }
};

export const getDistrictById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const district = await DistrictModel.findById(id);

    if (!district) {
      res.status(404).json({ error: "Distrito no encontrado" });
      return;
    }

    res.status(200).json({
      message: "Distrito obtenido correctamente",
      data: district,
    });
  } catch (error) {
    console.error(`Error al obtener distrito con ID ${req.params.id}:`, error);
    res.status(500).json({ error: "Error al obtener distrito" });
  }
};
