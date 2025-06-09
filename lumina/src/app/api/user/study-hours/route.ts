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
    const db = client.db('StudyTimes');
    const collection = db.collection('Hours');

    const result = await collection.findOne({
      _id: new ObjectId(userId),
    });

    await client.close();

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
    console.error('Error fetching study data:', error.message);
    return NextResponse.json(
      { error: 'Failed to load study data' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value;
  const { date, subject, duration } = await req.json();

  if (!userId || !date || !subject || typeof duration !== 'number') {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();
    const db = client.db('StudyTimes');
    const collection = db.collection('Hours');

    const query = { _id: new ObjectId(userId) };
    const update = {
      $inc: {
        [`studyData.${date}.${subject}`]: duration
      }
    };
    const options = { upsert: true };

    await collection.updateOne(query, update, options);
    await client.close();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving study time:', error);
    return NextResponse.json({ error: 'Failed to save study time' }, { status: 500 });
  }
}
