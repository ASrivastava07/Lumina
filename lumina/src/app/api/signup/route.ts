// app/api/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/mongodb'; // Path is correct

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    // --- Input Validation ---
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

    // --- Database Operations ---
    // ⭐ CORRECTED: Get the MongoClient instance
    const client = await connectToDatabase();
    // ⭐ Select the specific database for authentication
    const db = client.db(process.env.MONGODB_AUTH_DB_NAME || 'Authlogin'); // Using 'Authlogin' as a sensible default
    const usersCollection = db.collection(process.env.MONGODB_COLLECTION || 'Auth'); // Use collection name from env

    // Check for existing user
    const existingUser = await usersCollection.findOne({
      email: email.toLowerCase().trim(),
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'Account Already Exists' },
        { status: 409 }
      );
    }

    // Hash password and insert new user
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      createdAt: new Date(),
    };

    await usersCollection.insertOne(newUser);

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