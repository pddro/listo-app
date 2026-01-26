import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { GoogleGenAI } from '@google/genai';
import { generateListId } from '@/lib/utils/generateId';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// Supported languages for translation
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh-Hans', name: 'Simplified Chinese' },
  { code: 'zh-Hant', name: 'Traditional Chinese' },
  { code: 'ko', name: 'Korean' },
];

interface EnhancedContent {
  title: string;
  description: string;
}

interface TranslationResult {
  title: string;
  description: string;
  items: string[];
}

// Enhance title and generate SEO description using Gemini
async function enhanceTemplateContent(
  title: string,
  items: string[]
): Promise<EnhancedContent> {
  const prompt = `You are an SEO expert and copywriter. Given this checklist template, create:
1. An improved, SEO-friendly title (MAXIMUM 8 words, concise, descriptive, action-oriented)
2. A compelling description (2-3 sentences) that sells this template and is great for SEO

Title requirements:
- Must be 8 words or fewer
- Clear and descriptive
- SEO-friendly keywords
- Action-oriented when possible

The description should:
- Explain what the checklist helps accomplish
- Highlight key benefits
- Use persuasive language that makes people want to use it
- Be optimized for search engines

Return ONLY valid JSON in this exact format:
{
  "title": "improved title here (max 8 words)",
  "description": "compelling SEO description here"
}

Original title: ${title}
Checklist items:
${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-lite',
    contents: prompt,
  });

  const text = response.text?.trim() || '';

  // Extract JSON from response
  let jsonText = text;
  if (text.includes('```')) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      jsonText = match[1].trim();
    }
  }

  try {
    const result = JSON.parse(jsonText);
    return {
      title: result.title || title,
      description: result.description || '',
    };
  } catch {
    console.error('Failed to parse enhancement response:', text);
    return { title, description: '' };
  }
}

// Translate template content to a target language
async function translateTemplate(
  title: string,
  description: string,
  items: string[],
  targetLanguage: string
): Promise<TranslationResult> {
  const prompt = `Translate this checklist template to ${targetLanguage}. Maintain the same structure and meaning. Keep any special characters like # at the start of category headers.

Return ONLY valid JSON in this exact format:
{
  "title": "translated title",
  "description": "translated description",
  "items": ["translated item 1", "translated item 2", ...]
}

Template to translate:
Title: ${title}
Description: ${description || 'No description'}
Items:
${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-lite',
    contents: prompt,
  });

  const text = response.text?.trim() || '';

  let jsonText = text;
  if (text.includes('```')) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      jsonText = match[1].trim();
    }
  }

  try {
    const result = JSON.parse(jsonText);
    return {
      title: result.title || title,
      description: result.description || description,
      items: result.items || items,
    };
  } catch {
    console.error('Failed to parse translation response:', text);
    throw new Error(`Failed to parse translation for ${targetLanguage}`);
  }
}

// Background processing for template approval
async function processTemplateInBackground(
  originalTemplateId: string,
  template: {
    title: string;
    template_category: string;
    theme: unknown;
  },
  itemContents: string[]
) {
  try {
    console.log('Starting background processing for template:', originalTemplateId);

    // 1. Enhance title and generate SEO description with Gemini
    console.log('Enhancing template content with AI...');
    const enhanced = await enhanceTemplateContent(template.title, itemContents);
    console.log('Enhanced:', enhanced);

    // 2. Create translations for all 9 languages
    const translationGroupId = crypto.randomUUID();
    const createdTemplates: { language: string; id: string }[] = [];
    const errors: { language: string; error: string }[] = [];

    // Seed use_count with random number 9-100 for community feel
    const seededUseCount = Math.floor(Math.random() * 92) + 9;

    for (const lang of LANGUAGES) {
      try {
        console.log(`Processing ${lang.name}...`);

        let translatedTitle = enhanced.title;
        let translatedDescription = enhanced.description;
        let translatedItems = itemContents;

        // Translate for non-English languages
        if (lang.code !== 'en') {
          const translation = await translateTemplate(
            enhanced.title,
            enhanced.description,
            itemContents,
            lang.name
          );
          translatedTitle = translation.title;
          translatedDescription = translation.description;
          translatedItems = translation.items;
        }

        // Create the template record
        const newTemplateId = generateListId();

        const { error: insertError } = await supabaseServer
          .from('lists')
          .insert({
            id: newTemplateId,
            title: translatedTitle,
            is_template: true,
            template_description: translatedDescription || null,
            template_category: template.template_category,
            language: lang.code,
            translation_group_id: translationGroupId,
            theme: template.theme,
            use_count: seededUseCount,
            is_official: true,
            status: 'approved',
          });

        if (insertError) {
          throw new Error(insertError.message);
        }

        // Create items for this template
        const templateItems = translatedItems.map((content, index) => ({
          id: crypto.randomUUID(),
          list_id: newTemplateId,
          content,
          completed: false,
          parent_id: null,
          position: index,
        }));

        const { error: itemsInsertError } = await supabaseServer
          .from('items')
          .insert(templateItems);

        if (itemsInsertError) {
          await supabaseServer.from('lists').delete().eq('id', newTemplateId);
          throw new Error(itemsInsertError.message);
        }

        createdTemplates.push({ language: lang.code, id: newTemplateId });
        console.log(`Created ${lang.name} template: ${newTemplateId}`);

        // Small delay to avoid rate limiting
        if (lang.code !== 'ko') {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (err) {
        console.error(`Failed to process ${lang.name}:`, err);
        errors.push({
          language: lang.code,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // 3. Delete the original pending template (now replaced by translated versions)
    await supabaseServer.from('items').delete().eq('list_id', originalTemplateId);
    await supabaseServer.from('lists').delete().eq('id', originalTemplateId);

    console.log(`Background processing complete. Created ${createdTemplates.length} templates.`);
    if (errors.length > 0) {
      console.log('Errors:', errors);
    }
  } catch (err) {
    console.error('Background processing error:', err);
    // Mark as failed if something goes wrong
    await supabaseServer
      .from('lists')
      .update({ status: 'pending' })
      .eq('id', originalTemplateId);
  }
}

// GET /api/admin/templates/[templateId] - Get single template with items (admin)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const secret = searchParams.get('secret');

    // Verify admin secret
    if (!secret || secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch template (which is a list with is_template = true, any status for admin)
    const { data: template, error: templateError } = await supabaseServer
      .from('lists')
      .select('*')
      .eq('id', templateId)
      .eq('is_template', true)
      .single();

    if (templateError || !template) {
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
    console.error('Admin get template error:', error);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}

// PATCH /api/admin/templates/[templateId] - Approve or reject template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const secret = searchParams.get('secret');

    // Verify admin secret
    if (!secret || secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use "approve" or "reject"' },
        { status: 400 }
      );
    }

    // For reject, just update status
    if (action === 'reject') {
      const { error } = await supabaseServer
        .from('lists')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateId)
        .eq('is_template', true);

      if (error) {
        console.error('Update template status error:', error);
        return NextResponse.json({ error: 'Failed to reject template' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        status: 'rejected',
        message: 'Template rejected successfully',
      });
    }

    // For approve: mark as processing, then enhance & translate in background

    // 1. Fetch the template and its items first to validate
    const { data: template, error: templateError } = await supabaseServer
      .from('lists')
      .select('*')
      .eq('id', templateId)
      .eq('is_template', true)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const { data: items, error: itemsError } = await supabaseServer
      .from('items')
      .select('content, parent_id, position')
      .eq('list_id', templateId)
      .order('position', { ascending: true });

    if (itemsError) {
      return NextResponse.json({ error: 'Failed to fetch template items' }, { status: 500 });
    }

    // 2. Mark as processing and return immediately
    await supabaseServer
      .from('lists')
      .update({ status: 'processing' })
      .eq('id', templateId);

    // 3. Run enhancement and translation in background (don't await)
    const itemContents = (items || []).map((item: { content: string }) => item.content);

    processTemplateInBackground(templateId, template, itemContents).catch((err) => {
      console.error('Background processing failed:', err);
    });

    return NextResponse.json({
      success: true,
      status: 'processing',
      message: 'Template approval started. Enhancement and translation running in background.',
    });
  } catch (error) {
    console.error('Admin update template error:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

// DELETE /api/admin/templates/[templateId] - Delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const secret = searchParams.get('secret');

    // Verify admin secret
    if (!secret || secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete template list (items will cascade delete due to foreign key)
    const { error } = await supabaseServer
      .from('lists')
      .delete()
      .eq('id', templateId)
      .eq('is_template', true);

    if (error) {
      console.error('Delete template error:', error);
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('Admin delete template error:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
