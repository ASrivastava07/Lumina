import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

// Force this route to run in Node.js runtime
export const runtime = 'nodejs';

// Load environment variables
const uri = process.env.MONGODB_URI || '';
const dbName = process.env.MONGODB_DB || '';
const collectionName = process.env.MONGODB_COLLECTION || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, message: 'Missing fields' },
        { status: 400 }
      );
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection(collectionName);

    const existingUser = await users.findOne({
      email: email.toLowerCase().trim(),
    });

    if (existingUser) {
      await client.close();
      return NextResponse.json(
        { success: false, message: 'Email already registered' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      createdAt: new Date(),
    };

    await users.insertOne(newUser);
    await client.close();

    return NextResponse.json(
      { success: true, message: 'Signup successful!' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}