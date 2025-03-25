const Departamento = require("../models/department.model");
const Municipio = require("../models/municipality.model");
const Distrito = require("../models/district.model");

class CatalogService {
  async getAllDepartments() {
    return await Departamento.find().sort({ name: 1 });
  }

  async getDepartmentById(id) {
    return await Departamento.findById(id).populate({
      path: "municipalities",
      populate: {
        path: "districts",
      },
    });
  }

  async getMunicipalitiesByDepartment(departmentId) {
    return await Municipio.find({ department: departmentId }).sort({ name: 1 });
  }

  async getMunicipalityById(id) {
    return await Municipio.findById(id).populate("districts");
  }

  async getDistrictsByMunicipality(municipalityId) {
    return await Distrito.find({ municipality: municipalityId }).sort({
      name: 1,
    });
  }

  async getDistrictById(id) {
    return await Distrito.findById(id);
  }
}

module.exports = new CatalogService();
