import { Cliente, ReceptorDTO } from "../types";
import fs from "fs";
import path from "path";
import { logToFile } from "../../dte/utils/logUtils";

// Path to the JSON file where clientes will be stored
const DATA_FILE = path.join(process.cwd(), "data", "clientes.json");

// Initialize the data directory and file if they don't exist
function initializeDataStore() {
  const dataDir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
  }
}

// Read clientes from the JSON file
async function readClientes(): Promise<Cliente[]> {
  try {
    initializeDataStore();
    const data = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    logToFile(`Error reading clientes: ${error}`, "error");
    return [];
  }
}

// Write clientes to the JSON file
async function writeClientes(clientes: Cliente[]): Promise<void> {
  try {
    initializeDataStore();
    fs.writeFileSync(DATA_FILE, JSON.stringify(clientes, null, 2));
  } catch (error) {
    logToFile(`Error writing clientes: ${error}`, "error");
    throw new Error("Could not write to clientes data store");
  }
}

// Get all clientes
export async function getClientes(): Promise<Cliente[]> {
  return readClientes();
}

// Create a new cliente
export async function createCliente(
  cliente: Omit<Cliente, "id">
): Promise<Cliente> {
  const clientes = await readClientes();

  // Generate a new ID (simple implementation)
  const id =
    clientes.length > 0 ? Math.max(...clientes.map((c) => c.id)) + 1 : 1;

  const newCliente: Cliente = { ...cliente, id };
  clientes.push(newCliente);

  await writeClientes(clientes);
  return newCliente;
}

// Create a new cliente from receptor data
export async function createClienteFromReceptor(
  receptorData: ReceptorDTO
): Promise<Cliente> {
  const { receptor } = receptorData;

  // Check if cliente with this NRC already exists
  const clientes = await readClientes();
  const existingCliente = clientes.find((c) => c.nrc === receptor.nrc);

  if (existingCliente) {
    // Update the existing cliente with any new information
    return updateCliente(existingCliente.id, {
      nit: receptor.nit,
      nombre: receptor.nombre,
      codActividad: receptor.codActividad,
      descActividad: receptor.descActividad,
      nombreComercial: receptor.nombreComercial,
      telefono: receptor.telefono,
      correo: receptor.correo,
      direccion: receptor.direccion,
      updatedAt: new Date().toISOString(),
    });
  }

  // Create new cliente from receptor data
  const now = new Date().toISOString();
  const newCliente: Omit<Cliente, "id"> = {
    nit: receptor.nit,
    nrc: receptor.nrc,
    nombre: receptor.nombre,
    codActividad: receptor.codActividad,
    descActividad: receptor.descActividad,
    nombreComercial: receptor.nombreComercial,
    telefono: receptor.telefono,
    correo: receptor.correo,
    direccion: receptor.direccion,
    activo: true,
    createdAt: now,
    updatedAt: now,
  };

  return createCliente(newCliente);
}

// Update an existing cliente
export async function updateCliente(
  id: number,
  clienteData: Partial<Cliente>
): Promise<Cliente> {
  const clientes = await readClientes();
  const index = clientes.findIndex((c) => c.id === id);

  if (index === -1) {
    throw new Error(`Cliente with id ${id} not found`);
  }

  const updatedCliente = { ...clientes[index], ...clienteData, id };
  clientes[index] = updatedCliente;

  await writeClientes(clientes);
  return updatedCliente;
}

// Delete a cliente
export async function deleteCliente(id: number): Promise<void> {
  const clientes = await readClientes();
  const filteredClientes = clientes.filter((c) => c.id !== id);

  if (filteredClientes.length === clientes.length) {
    throw new Error(`Cliente with id ${id} not found`);
  }

  await writeClientes(filteredClientes);
}
