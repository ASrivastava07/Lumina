import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const response = new NextResponse(JSON.stringify({
    success: true,
    message: 'Logged out',
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  // Delete cookies
  response.cookies.set('is_logged_in', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });

  response.cookies.set('user_id', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });

  return response;
}