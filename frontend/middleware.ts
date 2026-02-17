import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Pass through all requests; middleware can be extended later
  // for API key injection on server-side requests
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip internal Next.js paths and static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
