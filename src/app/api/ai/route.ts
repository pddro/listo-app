import { NextRequest, NextResponse } from 'next/server';
import {
  manipulateList,
  generateListSuggestions,
  generateItemsFromPrompt,
  generateFromDictation,
  ListItem,
  ManipulatedItem,
  DictationResult
} from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, items, instruction, context, prompt } = body;

    switch (action) {
      case 'generate': {
        if (!prompt) {
          return NextResponse.json(
            { error: 'Prompt is required for generate action' },
            { status: 400 }
          );
        }
        const generated = await generateItemsFromPrompt(prompt);
        return NextResponse.json({ result: generated });
      }

      case 'manipulate': {
        if (!items || !Array.isArray(items)) {
          return NextResponse.json(
            { error: 'Items array is required' },
            { status: 400 }
          );
        }
        if (!instruction) {
          return NextResponse.json(
            { error: 'Instruction is required for manipulate action' },
            { status: 400 }
          );
        }
        const manipulated = await manipulateList(items as ListItem[], instruction);
        return NextResponse.json({ result: manipulated });
      }

      case 'suggest': {
        if (!items || !Array.isArray(items)) {
          return NextResponse.json(
            { error: 'Items array is required' },
            { status: 400 }
          );
        }
        const suggestions = await generateListSuggestions(
          items as ListItem[],
          context
        );
        return NextResponse.json({ result: suggestions });
      }

      case 'dictation': {
        if (!prompt) {
          return NextResponse.json(
            { error: 'Prompt (transcription) is required for dictation action' },
            { status: 400 }
          );
        }
        const dictationResult = await generateFromDictation(prompt);
        return NextResponse.json({ result: dictationResult });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "generate", "manipulate", or "suggest"' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('AI API error:', error);
    return NextResponse.json(
      { error: 'AI processing failed' },
      { status: 500 }
    );
  }
}
