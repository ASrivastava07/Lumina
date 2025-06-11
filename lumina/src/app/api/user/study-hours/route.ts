import { NextRequest, NextResponse } from 'next/server';
import { ObjectId, MongoServerError } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb'; // Corrected import path

export async function GET(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const client = await connectToDatabase();
    const db = client.db('StudyTimes'); // This line is correct
    const collection = db.collection('Hours');

    const result = await collection.findOne({
      _id: new ObjectId(userId),
    });

    if (!result || !result.studyData) {
      return NextResponse.json({ studyData: {} }, { status: 200 });
    }

    return NextResponse.json(
      {
        studyData: result.studyData,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching study data:', error);
    let errorMessage = 'Failed to load study data';
    if (error instanceof MongoServerError) {
        errorMessage = `Database error: ${error.message}`;
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value;
  const { date, subject, duration } = await req.json();

  if (!userId || !date || !subject || typeof duration !== 'number') {
    return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 });
  }

  try {
    const client = await connectToDatabase();
    const db = client.db('StudyTimes'); // This line is correct
    const collection = db.collection('Hours');

    const query = { _id: new ObjectId(userId) };
    const update = {
      $inc: {
        [`studyData.${date}.${subject}`]: duration
      }
    };
    const options = { upsert: true };

    await collection.updateOne(query, update, options);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error saving study time:', error);
    let errorMessage = 'Failed to save study time';
    if (error instanceof MongoServerError) {
        errorMessage = `Database error: ${error.message}`;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}