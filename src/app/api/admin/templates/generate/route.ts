import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { generateListId } from '@/lib/utils/generateId';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { TEMPLATE_CATEGORIES, TemplateCategory } from '@/types';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// Use thinking model for high quality output
const MODEL = 'gemini-3-flash-preview';

interface GeneratedTemplate {
  title: string;
  description: string;
  category: TemplateCategory;
  items: string[];
  themeDescription: string;
}

interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryPale: string;
  primaryGlow: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textPlaceholder: string;
  bgPrimary: string;
  bgSecondary: string;
  bgHover: string;
  borderLight: string;
  borderMedium: string;
  error: string;
}

// Generate template content with high thinking
async function generateTemplateContent(prompt: string): Promise<GeneratedTemplate> {
  const systemPrompt = `You are an expert checklist creator. Generate a comprehensive, well-organized checklist template based on the user's request.

## REQUIREMENTS
1. **Title**: Create a clear, SEO-friendly title (max 8 words)
2. **Description**: Write a compelling 2-3 sentence description that sells the template
3. **Category**: Choose the most appropriate category from: ${TEMPLATE_CATEGORIES.join(', ')}
4. **Items**: Create 10-25 well-organized checklist items
5. **Theme**: Suggest a visual theme description (e.g., "ocean blue", "forest green", "warm sunset")

## ITEM FORMAT
- Use #Category headers to organize items into logical groups
- Each header starts with # (e.g., "#Before You Leave", "#Essentials")
- Items under headers should be actionable and specific
- Include helpful details where appropriate

## EXAMPLE OUTPUT for "beach vacation packing list":
{
  "title": "Ultimate Beach Vacation Packing List",
  "description": "Never forget essentials for your beach getaway. This comprehensive checklist covers everything from swimwear to sun protection, ensuring a stress-free vacation.",
  "category": "travel",
  "items": [
    "#Clothing",
    "Swimsuits (2-3)",
    "Cover-ups and sarongs",
    "Casual summer dresses/shorts",
    "Sandals and flip-flops",
    "#Sun Protection",
    "Sunscreen SPF 30+",
    "Sunglasses with UV protection",
    "Wide-brimmed hat",
    "#Beach Gear",
    "Beach towels",
    "Cooler bag",
    "Waterproof phone pouch"
  ],
  "themeDescription": "tropical ocean with turquoise and sandy beige"
}

Return ONLY valid JSON matching this structure.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `${systemPrompt}\n\nUser request: ${prompt}`,
    config: {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.HIGH,
      },
    },
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

    // Validate category
    const category = TEMPLATE_CATEGORIES.includes(result.category)
      ? result.category
      : 'other';

    return {
      title: result.title || 'Untitled Template',
      description: result.description || '',
      category,
      items: Array.isArray(result.items) ? result.items : [],
      themeDescription: result.themeDescription || 'modern purple',
    };
  } catch {
    console.error('Failed to parse template generation response:', text);
    throw new Error('Failed to generate template content');
  }
}

// Generate theme colors
async function generateTheme(description: string): Promise<ThemeColors> {
  const prompt = `Generate a cohesive color theme for "${description}".

Return ONLY a JSON object with these exact color properties (all hex values):
{
  "primary": "#hex",
  "primaryDark": "#hex (darker shade)",
  "primaryLight": "#hex (lighter shade)",
  "primaryPale": "#hex (very light, for backgrounds)",
  "primaryGlow": "rgba(r,g,b,0.3) (for shadows/glows)",
  "textPrimary": "#hex (dark, for main text)",
  "textSecondary": "#hex (medium, for secondary text)",
  "textMuted": "#hex (light, for hints)",
  "textPlaceholder": "#hex (very light)",
  "bgPrimary": "#hex (tinted background, NOT white)",
  "bgSecondary": "#hex (slightly darker bg)",
  "bgHover": "#hex (hover state bg)",
  "borderLight": "#hex (subtle borders)",
  "borderMedium": "#hex (visible borders)",
  "error": "#hex (red tone for errors)"
}

IMPORTANT: bgPrimary should be a tinted color that matches the theme, not pure white.`;

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
    return JSON.parse(jsonText);
  } catch {
    // Return default theme on failure
    return {
      primary: '#6366f1',
      primaryDark: '#4f46e5',
      primaryLight: '#818cf8',
      primaryPale: '#e0e7ff',
      primaryGlow: 'rgba(99, 102, 241, 0.3)',
      textPrimary: '#1f2937',
      textSecondary: '#4b5563',
      textMuted: '#9ca3af',
      textPlaceholder: '#d1d5db',
      bgPrimary: '#f5f3ff',
      bgSecondary: '#ede9fe',
      bgHover: '#ddd6fe',
      borderLight: '#e5e7eb',
      borderMedium: '#d1d5db',
      error: '#ef4444',
    };
  }
}

// POST /api/admin/templates/generate - Generate a new template with AI
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const secret = searchParams.get('secret');

    // Verify admin secret
    if (!secret || secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    console.log('Generating template for:', prompt);

    // 1. Generate template content with high thinking
    const template = await generateTemplateContent(prompt);
    console.log('Generated template:', template.title);

    // 2. Generate theme
    const theme = await generateTheme(template.themeDescription);
    console.log('Generated theme for:', template.themeDescription);

    // 3. Create template in database
    const templateId = generateListId();

    const { error: insertError } = await supabaseServer
      .from('lists')
      .insert({
        id: templateId,
        title: template.title,
        is_template: true,
        template_description: template.description,
        template_category: template.category,
        language: 'en',
        theme,
        use_count: 0,
        is_official: false,
        status: 'pending', // Goes to pending for review
      });

    if (insertError) {
      console.error('Insert template error:', insertError);
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    // 4. Create items
    const templateItems = template.items.map((content, index) => ({
      id: crypto.randomUUID(),
      list_id: templateId,
      content,
      completed: false,
      parent_id: null,
      position: index,
    }));

    const { error: itemsError } = await supabaseServer
      .from('items')
      .insert(templateItems);

    if (itemsError) {
      console.error('Insert items error:', itemsError);
      await supabaseServer.from('lists').delete().eq('id', templateId);
      return NextResponse.json({ error: 'Failed to create template items' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      template_id: templateId,
      title: template.title,
      description: template.description,
      category: template.category,
      item_count: template.items.length,
      theme_description: template.themeDescription,
    });
  } catch (error) {
    console.error('Generate template error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
