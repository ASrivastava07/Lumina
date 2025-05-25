import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';


export const runtime = 'nodejs';

const uri = process.env.MONGODB_URI || '';
const dbName = process.env.MONGODB_DB || '';
const collectionName = process.env.MONGODB_COLLECTION || '';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown-ip';
  // Rate limiting logic goes here

  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection(collectionName);

    const user = await users.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    // Set cookies on successful login
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
      },
    });

    response.cookies.set('is_logged_in', 'true', {
      httpOnly: true, // prevents XSS
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
      sameSite: 'strict',
    });

    response.cookies.set('user_id', user._id.toString(), {
      httpOnly: true, // prevents XSS
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
      sameSite: 'strict',
    });

    return response;
  } catch (error: any) {
    console.error('Login Error:', error.message);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}