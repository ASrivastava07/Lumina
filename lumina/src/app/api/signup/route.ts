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
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, message: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Password must be at least 6 characters long' },
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

    await client.close();

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'Account Already Exists' },
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

    // Connect again to insert new user
    await client.connect();
    await users.insertOne(newUser);
    await client.close();

    return NextResponse.json(
      { success: true, message: 'Signup successful!' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Signup Error:', error.message);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}