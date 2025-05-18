import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';



export const runtime = 'nodejs';

const uri = process.env.MONGODB_URI!;
const dbName = process.env.MONGODB_DB!;
const collectionName = process.env.MONGODB_COLLECTION!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    const collection = client.db(dbName).collection(collectionName);

    // Fetch user by _id
    const user = await collection.findOne({
      _id: new ObjectId(userId),
    });

    if (!user) {
      await client.close();
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Sample data (replace with real logic later)
    await client.close();

    return new Response(
      JSON.stringify({
        name: user.name,
        dailyStudyTime: [
          { name: "Math", timeSpent: 60 },
          { name: "Science", timeSpent: 45 },
          { name: "History", timeSpent: 30 },
        ],
        weeklyTrends: [
          { date: "2023-10-01", hours: 5 },
          { date: "2023-10-02", hours: 6 },
          { date: "2023-10-03", hours: 4 },
        ],
        subjectAllocation: [
          { name: "Math", percentage: 40 },
          { name: "Science", percentage: 30 },
          { name: "History", percentage: 30 },
        ],
        performanceOverTime: [
          { date: "Week 1", score: 85, studyHours: 5 },
          { date: "Week 2", score: 90, studyHours: 6 },
          { date: "Week 3", score: 88, studyHours: 4 },
        ],
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching user data:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}