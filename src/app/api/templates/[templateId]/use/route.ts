import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { generateListId } from '@/lib/utils/generateId';

// POST /api/templates/[templateId]/use - Use a template (create new list)
export async function POST(
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
      .eq('status', 'approved')
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Fetch template items (regular items)
    const { data: templateItems, error: itemsError } = await supabaseServer
      .from('items')
      .select('*')
      .eq('list_id', templateId)
      .order('position', { ascending: true });

    if (itemsError) {
      console.error('Fetch template items error:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch template items' }, { status: 500 });
    }

    // Generate new list ID
    const newListId = generateListId();

    // Create new list from template (NOT a template - a regular list)
    const { error: listError } = await supabaseServer
      .from('lists')
      .insert({
        id: newListId,
        title: template.title,
        theme: template.theme,
        // Explicitly NOT a template
        is_template: false,
      });

    if (listError) {
      console.error('Create list error:', listError);
      return NextResponse.json({ error: 'Failed to create list' }, { status: 500 });
    }

    // Copy items with fresh IDs and parent mapping
    if (templateItems && templateItems.length > 0) {
      const idMapping: Record<string, string> = {};
      templateItems.forEach((item) => {
        idMapping[item.id] = crypto.randomUUID();
      });

      const newItems = templateItems.map((item) => ({
        id: idMapping[item.id],
        list_id: newListId,
        content: item.content,
        completed: false, // All items start unchecked
        parent_id: item.parent_id ? idMapping[item.parent_id] : null,
        position: item.position,
      }));

      const { error: itemsInsertError } = await supabaseServer
        .from('items')
        .insert(newItems);

      if (itemsInsertError) {
        console.error('Insert items error:', itemsInsertError);
        // Clean up list on failure
        await supabaseServer.from('lists').delete().eq('id', newListId);
        return NextResponse.json({ error: 'Failed to copy items' }, { status: 500 });
      }
    }

    // Increment use count on the template
    await supabaseServer.rpc('increment_template_use_count', {
      template_id_param: templateId,
    });

    return NextResponse.json({
      list_id: newListId,
      message: 'List created from template',
    });
  } catch (error) {
    console.error('Use template error:', error);
    return NextResponse.json({ error: 'Failed to use template' }, { status: 500 });
  }
}
