import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { isValidBackupCode, BackupPayload } from '@/lib/backup';

// CORS headers for mobile app access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/backup/[code] - Redeem a backup code
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const upperCode = code.toUpperCase();

    // Validate code format
    if (!isValidBackupCode(upperCode)) {
      return NextResponse.json(
        { error: 'Invalid code format' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Fetch the backup code
    const { data, error } = await supabaseServer
      .from('backup_codes')
      .select('data, expires_at, redeemed_at')
      .eq('code', upperCode)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Code not found or expired' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Check if expired
    const expiresAt = new Date(data.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Code has expired' },
        { status: 410, headers: corsHeaders }
      );
    }

    // Mark as redeemed (for tracking, not one-time use)
    if (!data.redeemed_at) {
      await supabaseServer
        .from('backup_codes')
        .update({ redeemed_at: new Date().toISOString() })
        .eq('code', upperCode);
    }

    // Return the backup payload
    const payload = data.data as BackupPayload;
    return NextResponse.json({
      lists: payload.lists,
      templates: payload.templates,
      createdAt: payload.createdAt,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Backup redeem error:', error);
    return NextResponse.json(
      { error: 'Failed to redeem backup code' },
      { status: 500, headers: corsHeaders }
    );
  }
}
