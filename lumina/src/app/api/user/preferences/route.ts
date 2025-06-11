// app/api/user/preferences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId, MongoServerError } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb'; // Corrected import path

const dbName = 'userpref';
const collectionName = 'Pref';

export async function GET(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const client = await connectToDatabase();
    const db = client.db(dbName); // This line is correct
    const collection = db.collection(collectionName);

    const result = await collection.findOne({ _id: new ObjectId(userId) });

    if (!result || !result.subjects || !result.subjectcolors) {
      return NextResponse.json({ subjects: [], subjectcolors: {} }, { status: 200 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching preferences:', error);
    let errorMessage = 'Failed to load preferences';
    if (error instanceof MongoServerError) {
        errorMessage = `Database error: ${error.message}`;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { subjects, subjectcolors } = await req.json();

    if (!subjects || !subjectcolors) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    const client = await connectToDatabase();
    const db = client.db(dbName); // This line is correct
    const collection = db.collection(collectionName);

    const result = await collection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          subjects,
          subjectcolors,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ message: 'Preferences saved', result }, { status: 200 });
  } catch (error: any) {
    console.error('Error saving preferences:', error);
    let errorMessage = 'Failed to save preferences';
    if (error instanceof MongoServerError) {
        errorMessage = `Database error: ${error.message}`;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}