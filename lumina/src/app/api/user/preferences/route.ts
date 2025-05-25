// app/api/user/preferences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

export async function GET(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();
    const db = client.db('userpref');
    const collection = db.collection('Pref');

    const result = await collection.findOne({
      _id: new ObjectId(userId),
    });

    await client.close();

    if (!result || !result.subjects || !result.subjectcolors) {
      return NextResponse.json(
        { subjects: [], subjectcolors: {} },
        { status: 200 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching preferences:', error.message);
    return NextResponse.json(
      { error: 'Failed to load preferences' },
      { status: 500 }
    );
  }
}