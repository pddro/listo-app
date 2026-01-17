import { NextResponse } from 'next/server';
import { generateEmoji } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const emoji = await generateEmoji(text);

    return NextResponse.json({ emoji });
  } catch (error) {
    console.error('Emojify error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Emojify failed' },
      { status: 500 }
    );
  }
}
