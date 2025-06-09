// app/api/user/preferences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI!;
const dbName = 'userpref';
const collectionName = 'Pref';

// GET method (already working)
export async function GET(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const result = await collection.findOne({ _id: new ObjectId(userId) });

    await client.close();

    if (!result || !result.subjects || !result.subjectcolors) {
      return NextResponse.json({ subjects: [], subjectcolors: {} }, { status: 200 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching preferences:', error.message);
    return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 });
  }
}

// ✅ NEW: POST method to update preferences
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

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const result = await collection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          subjects,
          subjectcolors,
        },
      },
      { upsert: true } // create doc if not exists
    );

    await client.close();

    return NextResponse.json({ message: 'Preferences saved', result }, { status: 200 });
  } catch (error: any) {
    console.error('Error saving preferences:', error.message);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}
