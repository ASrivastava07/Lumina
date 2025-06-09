import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';


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

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection(collectionName);

    const user = await users.findOne({ _id: new ObjectId(userId) });

    await client.close();

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      name: user.name,
      email: user.email,
    });
  } catch (err) {
    console.error('GET User Error:', (err as Error).message);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { name, email, password } = body;

    if (!name && !email && !password) {
      return NextResponse.json({ success: false, message: 'No fields to update' }, { status: 400 });
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection(collectionName);

    const updateFields: any = {};
    if (name) updateFields.name = name;
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ success: false, message: 'Invalid email format' }, { status: 400 });
      }
      updateFields.email = email.toLowerCase().trim();
    }
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ success: false, message: 'Password too short' }, { status: 400 });
      }
      updateFields.password = await bcrypt.hash(password, 10);
    }

    await users.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateFields }
    );

    await client.close();

    return NextResponse.json({ success: true, message: 'User info updated' });
  } catch (err: unknown) {
    console.error('Settings Update Error:', (err as Error).message);
    return NextResponse.json({ success: false, message: 'Failed to update user' }, { status: 500 });
  }
}