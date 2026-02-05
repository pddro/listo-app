import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { generateBackupCode, BackupPayload } from '@/lib/backup';

// CORS headers for mobile app access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST /api/backup - Create a backup code for quick transfer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lists, templates } = body;

    // Validate payload structure
    if (!Array.isArray(lists) || !Array.isArray(templates)) {
      return NextResponse.json(
        { error: 'lists and templates must be arrays' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Must have at least one item to backup
    if (lists.length === 0 && templates.length === 0) {
      return NextResponse.json(
        { error: 'Must include at least one list or template' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Generate unique code (retry if collision)
    let code = generateBackupCode();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const { data: existing } = await supabaseServer
        .from('backup_codes')
        .select('code')
        .eq('code', code)
        .single();

      if (!existing) break;

      code = generateBackupCode();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: 'Failed to generate unique code, please try again' },
        { status: 500, headers: corsHeaders }
      );
    }

    // Create the backup payload
    const payload: BackupPayload = {
      version: 1,
      createdAt: new Date().toISOString(),
      lists,
      templates,
    };

    // Calculate expiry (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Store in database
    const { error: insertError } = await supabaseServer
      .from('backup_codes')
      .insert({
        code,
        data: payload,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Backup insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create backup code' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      code,
      expiresAt: expiresAt.toISOString(),
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Backup API error:', error);
    return NextResponse.json(
      { error: 'Failed to create backup' },
      { status: 500, headers: corsHeaders }
    );
  }
}
