import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

// GET /api/admin/templates - List templates for review
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const secret = searchParams.get('secret');
    const status = searchParams.get('status') || 'pending';

    // Verify admin secret
    if (!secret || secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch templates (lists with is_template = true) by status
    const { data, error } = await supabaseServer
      .from('lists')
      .select(`
        id,
        title,
        template_description,
        template_category,
        language,
        theme,
        use_count,
        is_official,
        status,
        created_at,
        updated_at
      `)
      .eq('is_template', true)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Admin templates list error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get item counts for each template
    const templateIds = (data || []).map(t => t.id);
    const { data: itemCounts } = await supabaseServer
      .from('items')
      .select('list_id')
      .in('list_id', templateIds);

    // Count items per template
    const countMap: Record<string, number> = {};
    (itemCounts || []).forEach(item => {
      countMap[item.list_id] = (countMap[item.list_id] || 0) + 1;
    });

    // Map to expected format with item counts
    const templates = (data || []).map(row => ({
      id: row.id,
      title: row.title,
      template_description: row.template_description,
      template_category: row.template_category,
      language: row.language,
      theme: row.theme,
      use_count: row.use_count || 0,
      is_official: row.is_official,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      item_count: countMap[row.id] || 0,
    }));

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}
