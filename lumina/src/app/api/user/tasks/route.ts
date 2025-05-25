// app/api/user/tasks/route.ts
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
    const db = client.db('TaskManager');
    const collection = db.collection('UserTasks');

    const result = await collection.findOne({
      _id: new ObjectId(userId),
    });

    await client.close();

    if (!result || !result.tasks || !Array.isArray(result.tasks)) {
      return NextResponse.json([], { status: 200 });
    }

    // Clean up task subjects (remove trailing commas)
    const cleanedTasks = result.tasks.map((task: any) => ({
      id: task.id,
      title: task.title,
      subject: task.subject.replace(/,$/, ''), // Remove trailing comma
      deadline: task.deadline,
      completed: Boolean(task.completed),
    }));

    return NextResponse.json(cleanedTasks, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching tasks:', error.message);
    return NextResponse.json(
      { error: 'Failed to load tasks' },
      { status: 500 }
    );
  }
}