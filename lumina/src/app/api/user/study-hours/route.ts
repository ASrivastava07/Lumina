// app/api/user/study-hours/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

export async function GET(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');

  if (!userId || !date) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
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
      return NextResponse.json(
        { studyTime: {}, subjects: [] },
        { status: 200 }
      );
    }

    const studyTimeForDate = result.studyData[date] || {};
    const subjects = result.subjects || [];

    // Ensure all subjects have a value (default to 0 if not found)
    const fullStudyHours = subjects.reduce((acc: Record<string, number>, subject: string) => {
    acc[subject] = studyTimeForDate[subject] || 0;
    return acc;
    }, {});
    return NextResponse.json(
      {
        studyTime: fullStudyHours,
        subjects: subjects,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching study hours:', error.message);
    return NextResponse.json(
      { error: 'Failed to load study time' },
      { status: 500 }
    );
  }
}   