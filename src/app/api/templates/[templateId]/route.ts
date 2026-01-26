import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

// GET /api/templates/[templateId] - Get single template with items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;

    // Fetch template (which is a list with is_template = true)
    const { data: template, error: templateError } = await supabaseServer
      .from('lists')
      .select('*')
      .eq('id', templateId)
      .eq('is_template', true)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Only return approved templates (unless admin)
    if (template.status !== 'approved') {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Fetch items (regular items table)
    const { data: items, error: itemsError } = await supabaseServer
      .from('items')
      .select('*')
      .eq('list_id', templateId)
      .order('position', { ascending: true });

    if (itemsError) {
      console.error('Fetch template items error:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch template items' }, { status: 500 });
    }

    // Map to expected format (using actual field names)
    return NextResponse.json({
      template: {
        id: template.id,
        title: template.title,
        template_description: template.template_description,
        template_category: template.template_category,
        language: template.language,
        theme: template.theme,
        use_count: template.use_count || 0,
        is_official: template.is_official,
        status: template.status,
        created_at: template.created_at,
        updated_at: template.updated_at,
        items: items || [],
      },
    });
  } catch (error) {
    console.error('Get template error:', error);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}
