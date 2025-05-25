import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const isLoggedIn = req.cookies.get('is_logged_in')?.value === 'true';
  const userId = req.cookies.get('user_id')?.value;

  return NextResponse.json({ isLoggedIn, userId });
}