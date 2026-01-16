import { NextResponse } from 'next/server';
import { generateTheme, ThemeColors } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { description } = await request.json();

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Theme description is required' },
        { status: 400 }
      );
    }

    const theme = await generateTheme(description);

    return NextResponse.json({ theme });
  } catch (error) {
    console.error('Theme generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Theme generation failed' },
      { status: 500 }
    );
  }
}
