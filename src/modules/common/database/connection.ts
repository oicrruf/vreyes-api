/**
 * MongoDB connection utility
 */
import { MongoClient, Db, Collection, Document } from "mongodb";

// Update the connection URI to point to your actual MongoDB instance
// Examples:
// - Local with authentication: 'mongodb://username:password@localhost:27017/auto_task'
// - MongoDB Atlas: 'mongodb+srv://username:password@cluster.mongodb.net/auto_task'
// Ensure the URI is defined or throw an error
const uri =
  process.env.MONGODB_URL ||
  (() => {
    throw new Error("MONGODB_URL environment variable is not defined");
  })();

// MongoDB Client
let client: MongoClient | null = null;
let db: Db | null = null;

// Connect to database
export async function connectDB(): Promise<Db> {
  if (db) return db;

  try {
    // Add connection options for more reliability
    client = new MongoClient(uri, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    db = client.db();
    console.log("Connected to MongoDB database");
    return db;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
}

// Get collection
export function getCollection<T extends Document>(name: string): Collection<T> {
  if (!db) {
    throw new Error("Database not connected. Call connectDB() first.");
  }
  return db.collection<T>(name);
}

// Close connection
export async function closeConnection() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log("MongoDB connection closed");
  }
}
