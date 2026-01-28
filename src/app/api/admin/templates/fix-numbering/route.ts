import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

// POST /api/admin/templates/fix-numbering - Remove numbered prefixes from all template items
// This is a one-time fix endpoint
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const secret = searchParams.get('secret');

    // Verify admin secret
    if (!secret || secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all template list IDs
    const { data: templates, error: templatesError } = await supabaseServer
      .from('lists')
      .select('id')
      .eq('is_template', true);

    if (templatesError) {
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    const templateIds = templates?.map(t => t.id) || [];

    if (templateIds.length === 0) {
      return NextResponse.json({ message: 'No templates found', fixed: 0 });
    }

    // Get all items for these templates
    const { data: items, error: itemsError } = await supabaseServer
      .from('items')
      .select('id, content, list_id')
      .in('list_id', templateIds);

    if (itemsError) {
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    // Regex to match numbered prefix: "1. ", "12. ", etc.
    const numberedPrefixRegex = /^\d+\.\s*/;

    // Find items that need fixing
    const itemsToFix = (items || []).filter(item => numberedPrefixRegex.test(item.content));

    if (itemsToFix.length === 0) {
      return NextResponse.json({ message: 'No items need fixing', fixed: 0 });
    }

    // Fix each item
    let fixedCount = 0;
    const errors: { id: string; error: string }[] = [];

    for (const item of itemsToFix) {
      const fixedContent = item.content.replace(numberedPrefixRegex, '');

      const { error: updateError } = await supabaseServer
        .from('items')
        .update({ content: fixedContent })
        .eq('id', item.id);

      if (updateError) {
        errors.push({ id: item.id, error: updateError.message });
      } else {
        fixedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedCount} items`,
      fixed: fixedCount,
      total_checked: items?.length || 0,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Fix numbering endpoint error:', error);
    return NextResponse.json({ error: 'Fix failed' }, { status: 500 });
  }
}
