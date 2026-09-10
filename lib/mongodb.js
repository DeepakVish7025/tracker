import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "team_tracker";

if (!uri) throw new Error("MONGODB_URI is not set");

let cached = global._mongoClientPromise;
if (!cached) {
  cached = new MongoClient(uri).connect();
  global._mongoClientPromise = cached;
}

export async function getDb() {
  const client = await cached;
  return client.db(dbName);
}
