import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { generateListId } from '@/lib/utils/generateId';
import { GoogleGenAI } from '@google/genai';
import { TemplateCategory } from '@/types';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// Use a faster model for translation
const MODEL = 'gemini-2.0-flash-lite';

// Supported languages
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

interface TranslationResult {
  title: string;
  description: string;
  items: string[];
}

async function translateTemplate(
  title: string,
  description: string,
  items: string[],
  targetLanguage: string
): Promise<TranslationResult> {
  const prompt = `Translate this checklist template to ${targetLanguage}. Maintain the same structure and meaning. Keep any special characters like # at the start of category headers.

IMPORTANT: Do NOT add numbers or bullet points to the items. Return them exactly as formatted below (without the "- " prefix).

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
${items.map((item) => `- ${item}`).join('\n')}`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  const text = response.text?.trim() || '';

  // Extract JSON from response (handle markdown code blocks)
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

// POST /api/admin/templates/translate - Translate template to all languages
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const secret = searchParams.get('secret');

    // Verify admin secret
    if (!secret || secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { template_id, title, description, items, category, theme } = body;

    let sourceTitle = title;
    let sourceDescription = description;
    let sourceItems: string[] = items || [];
    let sourceCategory: TemplateCategory = category || 'other';
    let sourceTheme = theme || null;

    // If template_id provided, fetch from database
    if (template_id) {
      const { data: template, error: templateError } = await supabaseServer
        .from('lists')
        .select('*')
        .eq('id', template_id)
        .eq('is_template', true)
        .single();

      if (templateError || !template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      const { data: templateItems, error: itemsError } = await supabaseServer
        .from('items')
        .select('content')
        .eq('list_id', template_id)
        .order('position', { ascending: true });

      if (itemsError) {
        return NextResponse.json({ error: 'Failed to fetch template items' }, { status: 500 });
      }

      sourceTitle = template.title;
      sourceDescription = template.template_description || '';
      sourceItems = (templateItems || []).map((item) => item.content);
      sourceCategory = template.template_category;
      sourceTheme = template.theme;
    }

    if (!sourceTitle || sourceItems.length === 0) {
      return NextResponse.json(
        { error: 'Title and items are required' },
        { status: 400 }
      );
    }

    // Generate a translation group ID to link all translations
    const translationGroupId = crypto.randomUUID();
    const createdTemplates: { language: string; id: string }[] = [];
    const errors: { language: string; error: string }[] = [];

    // Process each language sequentially to avoid rate limits
    for (const lang of LANGUAGES) {
      try {
        console.log(`Translating to ${lang.name}...`);

        let translatedTitle = sourceTitle;
        let translatedDescription = sourceDescription;
        let translatedItems = sourceItems;

        // Skip translation for English (source language)
        if (lang.code !== 'en') {
          const translation = await translateTemplate(
            sourceTitle,
            sourceDescription,
            sourceItems,
            lang.name
          );
          translatedTitle = translation.title;
          translatedDescription = translation.description;
          translatedItems = translation.items;
        }

        // Create template record (a list with is_template = true)
        const newTemplateId = generateListId();

        const { error: insertError } = await supabaseServer
          .from('lists')
          .insert({
            id: newTemplateId,
            title: translatedTitle,
            is_template: true,
            template_description: translatedDescription || null,
            template_category: sourceCategory,
            language: lang.code,
            translation_group_id: translationGroupId,
            theme: sourceTheme,
            use_count: 0,
            is_official: true,
            status: 'approved',
          });

        if (insertError) {
          throw new Error(insertError.message);
        }

        // Create items (regular items pointing to template list)
        const templateItemsToInsert = translatedItems.map((content, index) => ({
          id: crypto.randomUUID(),
          list_id: newTemplateId,
          content,
          completed: false,
          parent_id: null,
          position: index,
        }));

        const { error: itemsInsertError } = await supabaseServer
          .from('items')
          .insert(templateItemsToInsert);

        if (itemsInsertError) {
          // Clean up template on failure
          await supabaseServer.from('lists').delete().eq('id', newTemplateId);
          throw new Error(itemsInsertError.message);
        }

        createdTemplates.push({ language: lang.code, id: newTemplateId });

        // Add a small delay to avoid rate limiting
        if (lang.code !== 'ko') {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (err) {
        console.error(`Failed to translate to ${lang.name}:`, err);
        errors.push({
          language: lang.code,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      translation_group_id: translationGroupId,
      created: createdTemplates,
      errors: errors.length > 0 ? errors : undefined,
      message: `Created ${createdTemplates.length} translations`,
    });
  } catch (error) {
    console.error('Translation endpoint error:', error);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
