import { NextRequest, NextResponse } from 'next/server';

// List of protected routes
const protectedRoutes = ['/dashboard'];

export function middleware(req: NextRequest) {
  const isLoggedIn = req.cookies.get('is_logged_in')?.value === 'true';
  const userId = req.cookies.get('user_id')?.value;

  const isProtectedRoute = protectedRoutes.some((route) =>
    req.nextUrl.pathname.startsWith(route)
  );

  // Block unauthenticated access to protected routes
  if (isProtectedRoute && (!isLoggedIn || !userId)) {
    return NextResponse.redirect(new URL('http://localhost:3000', req.url));
  }

  // Clear session if user revisits /login while logged in
  if (req.nextUrl.pathname === 'http://localhost:3000' && isLoggedIn && userId) {
    const response = NextResponse.next();

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

  return NextResponse.next();
}

// Apply middleware to these routes
export const config = {
  matcher: ['/dashboard', '/Log'],
};