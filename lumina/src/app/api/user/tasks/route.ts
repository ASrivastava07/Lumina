// /api/user/tasks/route.ts
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
    const db = client.db('TaskManager'); // This line is correct
    const collection = db.collection('Usertasks');

    const userDoc = await collection.findOne({ _id: new ObjectId(userId) });

    return NextResponse.json({
      tasks: userDoc?.tasks || [],
      category: userDoc?.category || [],
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    let errorMessage = 'Failed to load tasks';
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

  const { tasks, category } = await req.json();

  if (!Array.isArray(tasks) || !Array.isArray(category)) {
    return NextResponse.json({ error: 'Invalid data format for tasks or category' }, { status: 400 });
  }

  try {
    const client = await connectToDatabase();
    const db = client.db('TaskManager'); // This line is correct
    const collection = db.collection('Usertasks');

    await collection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { tasks, category } },
      { upsert: true }
    );
    
    return NextResponse.json({ success: true, message: 'Tasks and categories saved successfully' }, { status: 200 });
  } 
  catch (error: any) {
    console.error('Error saving tasks/category:', error);
    let errorMessage = 'Failed to save data';
    if (error instanceof MongoServerError) {
        errorMessage = `Database error: ${error.message}`;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  try {
    const body = await req.json();
    console.log('Received request body for PATCH /api/user/tasks:', body);
    
    const { categoryToDelete } = body;

    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json({ 
        error: 'Request body is empty or malformed',
        receivedBody: body 
      }, { status: 400 });
    }

    if (!categoryToDelete) {
      return NextResponse.json({ 
        error: 'categoryToDelete is required in the request body',
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

    const client = await connectToDatabase();
    const db = client.db('TaskManager'); // This line is correct
    const collection = db.collection('Usertasks');

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

    return NextResponse.json({ 
      success: true,
      message: 'Category and associated tasks deleted successfully',
      modifiedCount: result.modifiedCount
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error in PATCH /api/user/tasks:', error);
    let errorMessage = 'Server error while deleting category';
    if (error instanceof MongoServerError) {
        errorMessage = `Database error: ${error.message}`;
    }
    return NextResponse.json({ 
      error: errorMessage,
      details: error.message
    }, { status: 500 });
  }
}