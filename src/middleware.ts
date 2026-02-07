export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    /*
     * Protect all routes except:
     * - /login
     * - /api/auth (NextAuth routes)
     * - /_next (static assets)
     * - /favicon.ico, /icon.svg, etc.
     */
    '/((?!login|api/auth|_next/static|_next/image|favicon|icon|apple-touch-icon|manifest).*)',
  ],
};
