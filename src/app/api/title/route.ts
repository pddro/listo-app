import { NextResponse } from 'next/server';
import { generateTitle } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { items } = await request.json();

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Items array is required' },
        { status: 400 }
      );
    }

    const title = await generateTitle(items);

    return NextResponse.json({ title });
  } catch (error) {
    console.error('Title generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Title generation failed' },
      { status: 500 }
    );
  }
}
