// lib/mongodb.ts
import { MongoClient } from 'mongodb'; // No need to import Db here

const uri = process.env.MONGODB_URI || '';

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (!uri) {
  throw new Error('Please add your MONGODB_URI to .env.local');
}

if (process.env.NODE_ENV === 'development') {
  if (!(global as any)._mongoClientPromise) {
    client = new MongoClient(uri);
    (global as any)._mongoClientPromise = client.connect();
  }
  clientPromise = (global as any)._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export async function connectToDatabase() {
  const connectedClient = await clientPromise;
  // ⭐ Only return the MongoClient instance
  return connectedClient;
}

// Optional: Export clientPromise directly if you need it elsewhere for different operations
export default clientPromise;