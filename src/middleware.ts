import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n/config';

const intlMiddleware = createMiddleware({
  // List of all supported locales
  locales,

  // Default locale when no match
  defaultLocale,

  // Always show locale prefix in URL (/en/, /es/, etc.)
  localePrefix: 'always',

  // Auto-detect locale from Accept-Language header on first visit
  localeDetection: true,
});

export default function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';

  // Redirect listo.to → listmango.com (preserve path)
  if (host.includes('listo.to')) {
    const url = new URL(request.url);
    url.hostname = 'listmango.com';
    url.port = '';
    url.protocol = 'https:';
    return NextResponse.redirect(url, 301);
  }

  // Otherwise, run the i18n middleware
  return intlMiddleware(request);
}

export const config = {
  // Match all paths except:
  // - API routes (/api/*)
  // - Static files (_next/static/*, _next/image/*, favicon.ico, etc.)
  // - Public files (images, etc.)
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next`, `/_vercel`, or `/admin`
    // - … if they contain a dot (e.g. `favicon.ico`)
    '/((?!api|admin|_next|_vercel|.*\\..*).*)',
  ],
};
