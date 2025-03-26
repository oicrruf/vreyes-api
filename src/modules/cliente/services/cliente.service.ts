import { ObjectId } from "mongodb";
import { connectDB, getCollection } from "../../common/database/connection";
import { logToFile } from "../../dte/utils/logUtils";
import { Cliente, ReceptorDTO } from "../types";

const COLLECTION_NAME = "clientes";

// Connect to DB and get the collection
async function getClientesCollection() {
  await connectDB();
  return getCollection<Cliente>(COLLECTION_NAME);
}

// Get all clientes
export async function getClientes(): Promise<Cliente[]> {
  try {
    const collection = await getClientesCollection();
    return await collection.find({}).toArray();
  } catch (error) {
    logToFile(`Error in getClientes: ${error}`, "error");
    throw error;
  }
}

// Get cliente by ID
export async function getClienteById(id: string): Promise<Cliente | null> {
  try {
    const collection = await getClientesCollection();
    return await collection.findOne({ _id: new ObjectId(id) });
  } catch (error) {
    logToFile(`Error in getClienteById: ${error}`, "error");
    throw error;
  }
}

// Create a new cliente
export async function createCliente(cliente: Cliente): Promise<Cliente> {
  try {
    const collection = await getClientesCollection();

    // Validate required fields
    if (!cliente.nit || !cliente.nrc || !cliente.nombre) {
      throw new Error(
        "Missing required fields: nit, nrc, and nombre are required"
      );
    }

    // Set documento field to avoid the duplicate key error
    // Use nit as the documento value to ensure uniqueness
    cliente.documento = cliente.nit;

    // Format nit and nrc to ensure consistency
    cliente.nit = cliente.nit.trim();
    cliente.nrc = cliente.nrc.trim();

    // Check if cliente with same NRC or NIT already exists
    const existingCliente = await collection.findOne({
      $or: [{ nrc: cliente.nrc }, { nit: cliente.nit }],
    });

    if (existingCliente) {
      throw new Error(
        `Cliente with NRC ${cliente.nrc} or NIT ${cliente.nit} already exists`
      );
    }

    // Initialize facturas array for future invoice linkage
    cliente.facturas = cliente.facturas || [];

    // Ensure timestamps are present
    cliente.createdAt = cliente.createdAt || new Date();
    cliente.updatedAt = cliente.updatedAt || new Date();

    const result = await collection.insertOne(cliente);
    logToFile(
      `Cliente created successfully: ${cliente.nombre} (${cliente.nrc})`,
      "info"
    );
    return { ...cliente, _id: result.insertedId };
  } catch (error) {
    logToFile(`Error in createCliente: ${error}`, "error");
    throw error;
  }
}

// Update a cliente
export async function updateCliente(
  id: string,
  cliente: Partial<Cliente>
): Promise<Cliente | null> {
  try {
    const collection = await getClientesCollection();

    // Add updated timestamp
    const updateData = {
      ...cliente,
      updatedAt: new Date(),
    };

    // Remove _id from update data if present (MongoDB doesn't allow updating _id)
    if (updateData._id) {
      delete updateData._id;
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: "after" }
    );

    return result;
  } catch (error) {
    logToFile(`Error in updateCliente: ${error}`, "error");
    throw error;
  }
}

// Delete a cliente
export async function deleteCliente(id: string): Promise<boolean> {
  try {
    const collection = await getClientesCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  } catch (error) {
    logToFile(`Error in deleteCliente: ${error}`, "error");
    throw error;
  }
}

// Add a new function to link an invoice to a client
export async function linkInvoiceToClient(
  clienteId: string,
  facturaId: ObjectId
): Promise<boolean> {
  try {
    const collection = await getClientesCollection();
    const result = await collection.updateOne(
      { _id: new ObjectId(clienteId) },
      {
        $addToSet: { facturas: facturaId },
        $set: { updatedAt: new Date() },
      }
    );
    return result.modifiedCount > 0;
  } catch (error) {
    logToFile(`Error linking invoice to client: ${error}`, "error");
    throw error;
  }
}
