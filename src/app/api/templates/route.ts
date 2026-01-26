import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { generateListId } from '@/lib/utils/generateId';
import { TemplateCategory, TEMPLATE_CATEGORIES } from '@/types';

// GET /api/templates - List approved templates
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') as TemplateCategory | null;
    const language = searchParams.get('language') || 'en';
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    let query = supabaseServer
      .from('lists')
      .select('id, title, template_description, template_category, language, theme, use_count, is_official, created_at', { count: 'exact' })
      .eq('is_template', true)
      .eq('status', 'approved')
      .eq('language', language)
      .order('use_count', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category && TEMPLATE_CATEGORIES.includes(category)) {
      query = query.eq('template_category', category);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,template_description.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Templates list error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map to expected format for frontend (using actual field names)
    const templates = (data || []).map(row => ({
      id: row.id,
      title: row.title,
      template_description: row.template_description,
      template_category: row.template_category,
      language: row.language,
      theme: row.theme,
      use_count: row.use_count || 0,
      is_official: row.is_official,
      created_at: row.created_at,
    }));

    return NextResponse.json({
      templates,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Templates API error:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST /api/templates - Create a new template (submit for review)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { list_id, title, description, category, language } = body;

    // Validate required fields
    if (!list_id || !title || !category) {
      return NextResponse.json(
        { error: 'list_id, title, and category are required' },
        { status: 400 }
      );
    }

    if (!TEMPLATE_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      );
    }

    // Fetch source list
    const { data: sourceList, error: listError } = await supabaseServer
      .from('lists')
      .select('title, theme')
      .eq('id', list_id)
      .single();

    if (listError || !sourceList) {
      return NextResponse.json({ error: 'Source list not found' }, { status: 404 });
    }

    // Fetch source items
    const { data: sourceItems, error: itemsError } = await supabaseServer
      .from('items')
      .select('id, content, parent_id, position')
      .eq('list_id', list_id)
      .order('position', { ascending: true });

    if (itemsError) {
      console.error('Fetch items error:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch list items' }, { status: 500 });
    }

    if (!sourceItems || sourceItems.length === 0) {
      return NextResponse.json({ error: 'List has no items' }, { status: 400 });
    }

    // Generate new template ID
    const templateId = generateListId();

    // Create template (which is just a list with is_template = true)
    const { error: templateError } = await supabaseServer
      .from('lists')
      .insert({
        id: templateId,
        title,
        theme: sourceList.theme,
        is_template: true,
        template_description: description || null,
        template_category: category,
        language: language || 'en',
        use_count: 0,
        is_official: false,
        status: 'pending',
      });

    if (templateError) {
      console.error('Create template error:', templateError);
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    // Create ID mapping for parent relationships
    const idMapping: Record<string, string> = {};
    sourceItems.forEach((item) => {
      idMapping[item.id] = crypto.randomUUID();
    });

    // Copy items to template (they're just regular items pointing to the template list)
    const templateItems = sourceItems.map((item) => ({
      id: idMapping[item.id],
      list_id: templateId,
      content: item.content,
      completed: false,
      parent_id: item.parent_id ? idMapping[item.parent_id] : null,
      position: item.position,
    }));

    const { error: itemsInsertError } = await supabaseServer
      .from('items')
      .insert(templateItems);

    if (itemsInsertError) {
      console.error('Insert template items error:', itemsInsertError);
      // Clean up template on failure
      await supabaseServer.from('lists').delete().eq('id', templateId);
      return NextResponse.json({ error: 'Failed to copy items' }, { status: 500 });
    }

    return NextResponse.json({
      template_id: templateId,
      status: 'pending',
      message: 'Template submitted for review',
    });
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
