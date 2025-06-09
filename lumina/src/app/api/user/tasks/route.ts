// /api/user/tasks/route.ts
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
    const collection = db.collection('Usertasks');

    const userDoc = await collection.findOne({ _id: new ObjectId(userId) });

    await client.close();

    return NextResponse.json({
      tasks: userDoc?.tasks || [],
      category: userDoc?.category || [],
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching tasks:', error.message);
    return NextResponse.json({ error: 'Failed to load tasks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { tasks, category } = await req.json();

  if (!Array.isArray(tasks) || !Array.isArray(category)) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  }


  try {
    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();
    const db = client.db('TaskManager');
    const collection = db.collection('Usertasks');

    await collection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { tasks, category } },
      { upsert: true }
    );
    
    await client.close();

    return NextResponse.json({ success: true }, { status: 200 });
  } 
  catch (error: any) {
    console.error('Error saving tasks/category:', error.message);
    return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
  }
}


export async function PATCH(req: NextRequest) {

  const userId = req.cookies.get('user_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  try {
    const body = await req.json();
    console.log('Received request body:', body); // Debug log
    
    const { categoryToDelete } = body;

    // Detailed validation
    if (!body) {
      return NextResponse.json({ 
        error: 'Request body is empty',
        receivedBody: body 
      }, { status: 400 });
    }

    if (!categoryToDelete) {
      return NextResponse.json({ 
        error: 'categoryToDelete is required',
        receivedBody: body 
      }, { status: 400 });
    }

    if (typeof categoryToDelete !== 'string') {
      return NextResponse.json({ 
        error: 'categoryToDelete must be a string',
        receivedType: typeof categoryToDelete,
        receivedValue: categoryToDelete
      }, { status: 400 });
    }

    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();
    const db = client.db('TaskManager');
    const collection = db.collection('Usertasks');

    // Find the document first to verify it exists
    const userDoc = await collection.findOne({ _id: new ObjectId(userId) });
    if (!userDoc) {
      return NextResponse.json({ error: 'User document not found' }, { status: 404 });
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $pull: {
          category: categoryToDelete,
          'tasks': { subject: categoryToDelete }
        } as any
      }
    );

    await client.close();

    return NextResponse.json({ 
      success: true,
      message: 'Category deleted successfully',
      modifiedCount: result.modifiedCount
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error in PATCH /api/user/tasks:', error);
    return NextResponse.json({ 
      error: 'Server error while deleting category',
      details: error.message
    }, { status: 500 });
  }
}
