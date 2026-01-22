import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

export default createMiddleware({
  // List of all supported locales
  locales,

  // Default locale when no match
  defaultLocale,

  // Always show locale prefix in URL (/en/, /es/, etc.)
  localePrefix: 'always',

  // Auto-detect locale from Accept-Language header on first visit
  localeDetection: true,
});

export const config = {
  // Match all paths except:
  // - API routes (/api/*)
  // - Static files (_next/static/*, _next/image/*, favicon.ico, etc.)
  // - Public files (images, etc.)
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … if they contain a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
