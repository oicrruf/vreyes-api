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
    const result = await collection.insertOne(cliente);
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
