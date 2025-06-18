
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb'; 

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });
    }


    const client = await connectToDatabase();
  
    const db = client.db(process.env.MONGODB_AUTH_DB_NAME || 'Authlogin'); // Using 'Authlogin' 
    const usersCollection = db.collection(process.env.MONGODB_COLLECTION || 'Auth');

    const user = await usersCollection.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

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
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
      sameSite: 'strict',
    });

    response.cookies.set('user_id', user._id.toString(), {
      httpOnly: true,
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

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }


    const client = await connectToDatabase();

    const db = client.db(process.env.MONGODB_AUTH_DB_NAME || 'Authlogin');
    const usersCollection = db.collection(process.env.MONGODB_COLLECTION || 'Auth');


    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

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

    const client = await connectToDatabase();

    const db = client.db(process.env.MONGODB_AUTH_DB_NAME || 'Authlogin');
    const usersCollection = db.collection(process.env.MONGODB_COLLECTION || 'Auth');

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

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateFields }
    );

    return NextResponse.json({ success: true, message: 'User info updated' });
  } catch (err: unknown) {
    console.error('Settings Update Error:', (err as Error).message);
    return NextResponse.json({ success: false, message: 'Failed to update user' }, { status: 500 });
  }
}