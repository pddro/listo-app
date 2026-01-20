import { NextResponse } from 'next/server';

// Apple App Site Association file for Universal Links
// This allows listo.to URLs to open directly in the iOS app

export async function GET() {
  const appSiteAssociation = {
    applinks: {
      apps: [], // Must be empty array
      details: [
        {
          // Format: <Team ID>.<Bundle ID>
          appID: '535X74E25H.app.listo.to',
          paths: [
            // Match all list URLs (but not API routes or static files)
            '/[a-zA-Z0-9_-]*',
            // Explicitly exclude paths that should stay on web
            'NOT /api/*',
            'NOT /_next/*',
            'NOT /favicon.ico',
          ],
        },
      ],
    },
  };

  return NextResponse.json(appSiteAssociation, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
