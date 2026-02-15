import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { generateListId } from '@/lib/utils/generateId';
import { generateItemsFromUrl } from '@/lib/gemini';

// POST /api/embed/create - Create a branded list from a URL
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, siteId } = body as { url: string; siteId: string };

    if (!url || !siteId) {
      return NextResponse.json(
        { error: 'url and siteId are required' },
        { status: 400 }
      );
    }

    // Look up embed site
    const { data: site, error: siteError } = await supabaseServer
      .from('embed_sites')
      .select('*')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Check for existing template for this URL
    const { data: existingTemplate } = await supabaseServer
      .from('lists')
      .select('*')
      .eq('is_template', true)
      .eq('source_url', url)
      .single();

    let templateId: string;

    if (existingTemplate) {
      // Cache HIT — clone from existing template
      templateId = existingTemplate.id;
    } else {
      // Cache MISS — generate content and create template
      console.log('[embed/create] Cache miss, generating content for:', url);

      // Generate items from the URL using Gemini
      const generatedItems = await generateItemsFromUrl(url);

      if (!generatedItems || generatedItems.length === 0) {
        return NextResponse.json(
          { error: 'Failed to extract content from URL' },
          { status: 422 }
        );
      }

      // Generate a title from the URL metadata or first few items
      let title = 'Untitled List';
      try {
        const { generateTitle } = await import('@/lib/gemini');
        const itemContents = generatedItems
          .filter((i) => !i.content.startsWith('#'))
          .map((i) => i.content)
          .slice(0, 10);
        title = await generateTitle(itemContents);
      } catch {
        // fallback title is fine
      }

      // Create template list
      const newTemplateId = generateListId();
      const { error: templateError } = await supabaseServer
        .from('lists')
        .insert({
          id: newTemplateId,
          title,
          theme: site.theme,
          is_template: true,
          source_url: url,
          source_site_id: siteId,
          status: 'approved',
          template_category: 'other',
          language: 'en',
        });

      if (templateError) {
        console.error('[embed/create] Template create error:', templateError);
        return NextResponse.json(
          { error: 'Failed to create template' },
          { status: 500 }
        );
      }

      // Insert generated items into the template
      // First, create ID mapping for parent references
      const idMapping: Record<string, string> = {};
      for (const item of generatedItems) {
        idMapping[item.id] = crypto.randomUUID();
      }

      const templateItems = generatedItems.map((item) => ({
        id: idMapping[item.id],
        list_id: newTemplateId,
        content: item.content,
        completed: false,
        parent_id: item.parent_id ? idMapping[item.parent_id] : null,
        position: item.position,
      }));

      const { error: itemsError } = await supabaseServer
        .from('items')
        .insert(templateItems);

      if (itemsError) {
        console.error('[embed/create] Items insert error:', itemsError);
        // Cleanup template
        await supabaseServer.from('lists').delete().eq('id', newTemplateId);
        return NextResponse.json(
          { error: 'Failed to create template items' },
          { status: 500 }
        );
      }

      templateId = newTemplateId;
    }

    // Clone template into a regular list for the user
    const newListId = generateListId();

    // Fetch template data
    const { data: template } = await supabaseServer
      .from('lists')
      .select('*')
      .eq('id', templateId)
      .single();

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found after creation' },
        { status: 500 }
      );
    }

    // Fetch template items
    const { data: templateItems } = await supabaseServer
      .from('items')
      .select('*')
      .eq('list_id', templateId)
      .order('position', { ascending: true });

    // Create the user's list (NOT a template)
    const { error: listError } = await supabaseServer.from('lists').insert({
      id: newListId,
      title: template.title,
      theme: site.theme, // Always use site's theme
      is_template: false,
      source_url: url,
      source_site_id: siteId,
    });

    if (listError) {
      console.error('[embed/create] List create error:', listError);
      return NextResponse.json(
        { error: 'Failed to create list' },
        { status: 500 }
      );
    }

    // Copy items with fresh IDs and remapped parent_ids
    if (templateItems && templateItems.length > 0) {
      const idMapping: Record<string, string> = {};
      templateItems.forEach((item) => {
        idMapping[item.id] = crypto.randomUUID();
      });

      const newItems = templateItems.map((item) => ({
        id: idMapping[item.id],
        list_id: newListId,
        content: item.content,
        completed: false,
        parent_id: item.parent_id ? idMapping[item.parent_id] : null,
        position: item.position,
      }));

      const { error: itemsInsertError } = await supabaseServer
        .from('items')
        .insert(newItems);

      if (itemsInsertError) {
        console.error('[embed/create] Clone items error:', itemsInsertError);
        await supabaseServer.from('lists').delete().eq('id', newListId);
        return NextResponse.json(
          { error: 'Failed to copy items' },
          { status: 500 }
        );
      }
    }

    // Increment use count on the template
    await supabaseServer.rpc('increment_template_use_count', {
      template_id_param: templateId,
    });

    return NextResponse.json({ listId: newListId });
  } catch (error) {
    console.error('[embed/create] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
