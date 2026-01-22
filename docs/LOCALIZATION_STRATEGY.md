# Listo Localization Strategy

## Executive Summary

This document outlines a comprehensive plan to localize the Listo web app into multiple languages while maintaining sustainability, SEO optimization, and leveraging AI for automated translation of new strings.

---

## 1. Current State Analysis

### Strings Inventory

| Location | Approximate Count | Type |
|----------|-------------------|------|
| Home page (`page.tsx`) | ~100+ | Marketing, tutorial, privacy |
| Command palette | ~35 | Labels, descriptions |
| NewItemInput | ~30 | Mode indicators, errors |
| List page (`client.tsx`) | ~20 | Share, export options |
| DictateButton | ~10 | Recording states |
| API routes | ~20 | Error messages |
| **Total** | **~215+** | Static UI strings |

### Current Challenges
- All strings hardcoded in components
- No i18n infrastructure exists
- AI prompts are English-only
- No language detection or preference storage

---

## 2. Recommended Architecture

### Library Choice: `next-intl`

**Why `next-intl` over alternatives:**
- Native Next.js App Router support (Next.js 16 compatible)
- Built-in SEO support with locale-prefixed routes
- Type-safe translations with TypeScript
- Server component support (important for SSR/SEO)
- Smaller bundle than `next-i18next`
- Active maintenance and good documentation

```bash
npm install next-intl
```

### Directory Structure

```
/messages/
  /en.json           # English (default)
  /es.json           # Spanish
  /fr.json           # French
  /de.json           # German
  /pt.json           # Portuguese
  /ja.json           # Japanese
  /zh.json           # Chinese (Simplified)
  /ar.json           # Arabic (RTL)
  /ko.json           # Korean

/src/
  /i18n/
    config.ts        # Locale configuration
    request.ts       # Server-side i18n setup
    navigation.ts    # Localized Link, useRouter
    ai-translate.ts  # AI translation service

  /app/
    /[locale]/       # Locale-prefixed routes
      page.tsx       # Home
      /[listId]/
        page.tsx     # List view
      layout.tsx     # Root layout with locale provider
```

---

## 3. String Organization

### JSON Structure (Namespace-based)

```json
// /messages/en.json
{
  "metadata": {
    "title": "Listo - AI-Powered Shareable Lists",
    "description": "Create lists, share links, collaborate in real-time."
  },
  "home": {
    "title": "Listo",
    "tagline": "Create a list. Share the link. Collaborate in real-time.",
    "benefits": {
      "noSignup": "No signup",
      "realtime": "Real-time sharing",
      "aiPowered": "AI-powered"
    },
    "buttons": {
      "create": "Create",
      "restore": "Restore",
      "archived": "Archived"
    },
    "placeholders": [
      "groceries for tacos",
      "packing for beach vacation",
      "questions for doctor visit",
      "movies to watch this weekend"
    ]
  },
  "list": {
    "untitled": "Untitled List",
    "share": {
      "copyLink": "Copy link",
      "copyMarkdown": "Copy as Markdown",
      "linkCopied": "Link copied!",
      "sendEmail": "Send via email",
      "exportTodoist": "Export for Todoist",
      "instruction": "Anyone with this link can view and edit the list in real-time."
    },
    "footer": {
      "createdWith": "Created with Listo",
      "home": "Home",
      "newList": "New List"
    }
  },
  "input": {
    "placeholder": "Add items...",
    "modes": {
      "generate": "AI will generate items",
      "transform": "AI will transform list",
      "theme": "AI will generate theme",
      "addingItems": "Adding {count} items",
      "emoji": "Trigger emoji mode",
      "title": "Generate list title",
      "note": "Type your note..."
    },
    "processing": {
      "thinking": "AI is thinking...",
      "generatingTheme": "Generating theme...",
      "reorganizing": "Reorganizing list...",
      "unknownCommand": "Unknown command"
    }
  },
  "commands": {
    "title": "Commands",
    "done": "Done",
    "sections": {
      "aiFeatures": "AI Features",
      "quickActions": "Quick Actions",
      "modes": "Modes"
    },
    "items": {
      "generate": {
        "label": "Generate Items",
        "description": "AI creates items from your description"
      },
      "transform": {
        "label": "AI Transform",
        "description": "Transform your list any way you want"
      },
      "theme": {
        "label": "Custom Theme",
        "description": "Generate colors from a description"
      },
      "completeAll": {
        "label": "Complete All",
        "description": "Mark all items as done"
      }
    }
  },
  "dictation": {
    "listening": "Listening...",
    "tapToStop": "Tap anywhere to stop",
    "cancel": "Cancel",
    "timeRemaining": "{time} remaining",
    "microphoneDenied": "Microphone access denied"
  },
  "errors": {
    "promptRequired": "Prompt is required",
    "itemsRequired": "Items array is required",
    "aiProcessingFailed": "AI processing failed",
    "themeGenerationFailed": "Theme generation failed",
    "noItemsToReorganize": "No items to reorganize"
  },
  "tutorial": {
    "gettingStarted": {
      "title": "Getting Started",
      "items": [
        "Type anything and press enter to add items",
        "Tap an item to mark it complete",
        "Swipe left to delete an item",
        "Share this list - anyone with the link can edit!"
      ]
    }
  },
  "themes": {
    "sunset": "sunset",
    "ocean": "ocean",
    "forest": "forest",
    "neon": "neon",
    "midnight": "midnight"
  }
}
```

### Key Design Decisions

1. **Flat namespaces**: Use dot notation (`home.title`) for easy lookup
2. **Interpolation**: Use `{variable}` syntax for dynamic values
3. **Arrays for ordered content**: Placeholders, tutorial items
4. **Grouped by feature**: Easier to find and maintain

---

## 4. URL Structure & SEO

### Route Structure

```
/                    → Redirects to /en (or detected locale)
/en                  → English home
/en/abc123           → English list view
/es                  → Spanish home
/es/abc123           → Spanish list view
/fr                  → French home
```

### SEO Implementation

#### A. Alternate Language Tags (hreflang)

```tsx
// /src/app/[locale]/layout.tsx
export function generateMetadata({ params }: Props): Metadata {
  return {
    alternates: {
      canonical: `https://listo.app/${params.locale}`,
      languages: {
        'en': 'https://listo.app/en',
        'es': 'https://listo.app/es',
        'fr': 'https://listo.app/fr',
        'de': 'https://listo.app/de',
        'x-default': 'https://listo.app/en',
      },
    },
  };
}
```

#### B. Sitemap Generation

```tsx
// /src/app/sitemap.ts
const locales = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh', 'ko'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrls = locales.map((locale) => ({
    url: `https://listo.app/${locale}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 1.0,
    alternates: {
      languages: Object.fromEntries(
        locales.map((l) => [l, `https://listo.app/${l}`])
      ),
    },
  }));

  return baseUrls;
}
```

#### C. Language Detection & Redirect

```tsx
// /src/middleware.ts
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localeDetection: true,  // Uses Accept-Language header
  localePrefix: 'always', // /en, /es always in URL
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

#### D. Metadata per Locale

```tsx
// /src/app/[locale]/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'metadata' });

  return {
    title: t('title'),
    description: t('description'),
    openGraph: {
      title: t('title'),
      description: t('description'),
      locale: params.locale,
    },
  };
}
```

### SEO Best Practices for Multilingual Sites

1. **One URL per language**: `/en/page` and `/es/page` are separate URLs
2. **hreflang tags**: Tell Google about language variants
3. **x-default**: Specify fallback for unmatched languages
4. **Canonical URLs**: Each language version is canonical for itself
5. **Language-specific sitemaps**: Include all locale URLs
6. **Server-side rendering**: Critical for SEO - `next-intl` supports this
7. **No automatic redirects** based on IP: Use language detection only on first visit

---

## 5. Handling New Strings

### Development Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEW STRING WORKFLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Developer adds new string to /messages/en.json                 │
│                         │                                       │
│                         ▼                                       │
│  Pre-commit hook detects new keys                               │
│                         │                                       │
│                         ▼                                       │
│  AI Translation API called for missing keys                     │
│                         │                                       │
│                         ▼                                       │
│  Translations added to all locale files                         │
│                         │                                       │
│                         ▼                                       │
│  Developer reviews & commits                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation: AI Auto-Translation Script

```typescript
// /scripts/translate-strings.ts
import { GoogleGenAI } from '@google/genai';

const LOCALES = ['es', 'fr', 'de', 'pt', 'ja', 'zh', 'ko', 'ar'];
const SOURCE_LOCALE = 'en';

interface TranslationBatch {
  key: string;
  sourceText: string;
  context?: string;
}

async function translateBatch(
  strings: TranslationBatch[],
  targetLocale: string
): Promise<Record<string, string>> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `You are a professional translator for a list/productivity app called "Listo".

Translate the following strings from English to ${getLanguageName(targetLocale)}.

CRITICAL RULES:
1. Preserve all {variables} exactly as written (they are interpolation placeholders)
2. Keep the same tone - casual, friendly, simple
3. Keep translations concise (similar length to English)
4. For technical terms (AI, URL, etc.), keep them in English if that's common in the target language
5. Return ONLY valid JSON with the same keys

Strings to translate:
${JSON.stringify(strings.map(s => ({ key: s.key, text: s.sourceText })), null, 2)}

Return JSON format:
{
  "key1": "translated text 1",
  "key2": "translated text 2"
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-lite',
    contents: prompt,
  });

  return JSON.parse(response.text);
}

async function syncTranslations() {
  const enStrings = await loadJsonFile(`/messages/${SOURCE_LOCALE}.json`);

  for (const locale of LOCALES) {
    const localeStrings = await loadJsonFile(`/messages/${locale}.json`);
    const missingKeys = findMissingKeys(enStrings, localeStrings);

    if (missingKeys.length === 0) {
      console.log(`✓ ${locale}: All strings translated`);
      continue;
    }

    console.log(`→ ${locale}: Translating ${missingKeys.length} new strings...`);

    const batch = missingKeys.map(key => ({
      key,
      sourceText: getNestedValue(enStrings, key),
    }));

    const translations = await translateBatch(batch, locale);

    // Merge translations into locale file
    for (const [key, value] of Object.entries(translations)) {
      setNestedValue(localeStrings, key, value);
    }

    await saveJsonFile(`/messages/${locale}.json`, localeStrings);
    console.log(`✓ ${locale}: Added ${missingKeys.length} translations`);
  }
}
```

### Git Hook Integration

```json
// package.json
{
  "scripts": {
    "i18n:check": "node scripts/check-missing-translations.js",
    "i18n:sync": "node scripts/translate-strings.js",
    "precommit": "npm run i18n:check && npm run i18n:sync"
  },
  "husky": {
    "hooks": {
      "pre-commit": "npm run precommit"
    }
  }
}
```

### CI/CD Integration

```yaml
# .github/workflows/i18n.yml
name: Translation Sync

on:
  push:
    paths:
      - 'messages/en.json'

jobs:
  sync-translations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Sync translations
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: npm run i18n:sync

      - name: Create PR with translations
        uses: peter-evans/create-pull-request@v5
        with:
          title: 'i18n: Auto-translate new strings'
          body: 'Automated translations for new strings in en.json'
          branch: i18n-auto-translate
```

---

## 6. Database Considerations

### List Language Preference (Optional)

```sql
-- Add language preference to lists table
ALTER TABLE lists ADD COLUMN locale TEXT DEFAULT 'en';

-- Index for analytics
CREATE INDEX idx_lists_locale ON lists(locale);
```

### Use Cases for Stored Locale
- AI-generated content in user's language
- Default UI language when opening shared list
- Analytics on language usage

---

## 7. AI Integration Adaptation

### Localized AI Prompts

```typescript
// /src/lib/ai/prompts.ts
export const AI_SYSTEM_PROMPTS = {
  en: {
    generateItems: `You are a helpful assistant that generates list items.
                    Generate practical, actionable items. Be concise.`,
    manipulate: `You are reorganizing a list. Follow the user's instructions exactly.`,
  },
  es: {
    generateItems: `Eres un asistente útil que genera elementos de lista.
                    Genera elementos prácticos y accionables. Sé conciso.`,
    manipulate: `Estás reorganizando una lista. Sigue las instrucciones del usuario exactamente.`,
  },
  // ... other locales
};

// Usage in API route
export async function generateItems(prompt: string, locale: string = 'en') {
  const systemPrompt = AI_SYSTEM_PROMPTS[locale]?.generateItems
                      || AI_SYSTEM_PROMPTS.en.generateItems;

  // Add language instruction for response
  const fullPrompt = `${systemPrompt}\n\nRespond in ${getLanguageName(locale)}.\n\n${prompt}`;

  return await ai.generate(fullPrompt);
}
```

### Language-Aware Response Generation

```typescript
// The AI can detect user's language from:
// 1. URL locale parameter
// 2. Accept-Language header
// 3. User's input language (auto-detect)

async function handleAIRequest(req: Request) {
  const locale = req.headers.get('x-locale') || 'en';
  const userInput = await req.text();

  // Detect if user typed in a different language
  const detectedLang = await detectLanguage(userInput);
  const responseLocale = detectedLang || locale;

  const response = await generateWithLocale(userInput, responseLocale);
  return response;
}
```

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Install `next-intl`
- [ ] Create `/messages/en.json` with all extracted strings
- [ ] Set up `[locale]` route structure
- [ ] Implement middleware for locale detection
- [ ] Update layout with `NextIntlClientProvider`

### Phase 2: String Extraction (Week 2)
- [ ] Extract strings from home page
- [ ] Extract strings from list page
- [ ] Extract strings from all components
- [ ] Extract API error messages
- [ ] Test English version works correctly

### Phase 3: Initial Translations (Week 3)
- [ ] Set up AI translation script
- [ ] Generate Spanish translations
- [ ] Generate French translations
- [ ] Generate German translations
- [ ] Manual review of translations

### Phase 4: SEO & Polish (Week 4)
- [ ] Implement hreflang tags
- [ ] Generate multilingual sitemap
- [ ] Add language switcher component
- [ ] Add og:locale metadata
- [ ] Test with Google Search Console

### Phase 5: Automation (Week 5)
- [ ] Set up pre-commit hooks
- [ ] Configure GitHub Actions workflow
- [ ] Add translation coverage reporting
- [ ] Document process for contributors

### Phase 6: Expand Languages (Ongoing)
- [ ] Portuguese
- [ ] Japanese
- [ ] Chinese (Simplified)
- [ ] Korean
- [ ] Arabic (with RTL support)

---

## 9. Component Refactoring Examples

### Before (Hardcoded)

```tsx
// NewItemInput.tsx
<span className="text-sm text-gray-500">
  AI will generate items
</span>
```

### After (Localized)

```tsx
// NewItemInput.tsx
import { useTranslations } from 'next-intl';

export function NewItemInput() {
  const t = useTranslations('input');

  return (
    <span className="text-sm text-gray-500">
      {t('modes.generate')}
    </span>
  );
}
```

### Interpolation Example

```tsx
// Before
<span>Adding {count} items</span>

// After
<span>{t('modes.addingItems', { count })}</span>

// In en.json: "addingItems": "Adding {count} items"
// In es.json: "addingItems": "Añadiendo {count} elementos"
```

---

## 10. Language Switcher Component

```tsx
// /src/components/LanguageSwitcher.tsx
'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

const LANGUAGES = {
  en: { name: 'English', flag: '🇺🇸' },
  es: { name: 'Español', flag: '🇪🇸' },
  fr: { name: 'Français', flag: '🇫🇷' },
  de: { name: 'Deutsch', flag: '🇩🇪' },
  pt: { name: 'Português', flag: '🇧🇷' },
  ja: { name: '日本語', flag: '🇯🇵' },
  zh: { name: '中文', flag: '🇨🇳' },
  ko: { name: '한국어', flag: '🇰🇷' },
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const handleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      className="bg-transparent border rounded px-2 py-1"
    >
      {Object.entries(LANGUAGES).map(([code, { name, flag }]) => (
        <option key={code} value={code}>
          {flag} {name}
        </option>
      ))}
    </select>
  );
}
```

---

## 11. RTL (Right-to-Left) Support

For Arabic and Hebrew support:

```tsx
// /src/app/[locale]/layout.tsx
import { getLocale } from 'next-intl/server';

const RTL_LOCALES = ['ar', 'he'];

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body>{children}</body>
    </html>
  );
}
```

```css
/* Tailwind RTL utilities */
.rtl\:space-x-reverse > :not([hidden]) ~ :not([hidden]) {
  --tw-space-x-reverse: 1;
}
```

---

## 12. Testing Translations

```typescript
// /tests/i18n/translations.test.ts
import en from '@/messages/en.json';
import es from '@/messages/es.json';

describe('Translation completeness', () => {
  const enKeys = getAllKeys(en);
  const esKeys = getAllKeys(es);

  test('Spanish has all English keys', () => {
    const missing = enKeys.filter(k => !esKeys.includes(k));
    expect(missing).toHaveLength(0);
  });

  test('No empty translations in Spanish', () => {
    const emptyKeys = esKeys.filter(k => !getNestedValue(es, k));
    expect(emptyKeys).toHaveLength(0);
  });

  test('Interpolation variables preserved', () => {
    for (const key of enKeys) {
      const enVal = getNestedValue(en, key);
      const esVal = getNestedValue(es, key);

      const enVars = enVal.match(/\{[^}]+\}/g) || [];
      const esVars = esVal.match(/\{[^}]+\}/g) || [];

      expect(esVars.sort()).toEqual(enVars.sort());
    }
  });
});
```

---

## 13. Cost Estimation

### AI Translation Costs (Gemini)

| Scenario | Strings | Tokens/String | Total Tokens | Cost (approx) |
|----------|---------|---------------|--------------|---------------|
| Initial batch (9 locales) | 215 × 9 = 1,935 | ~50 | 96,750 | ~$0.10 |
| Weekly additions (5 new) | 5 × 9 = 45 | ~50 | 2,250 | ~$0.003 |
| Monthly | ~180 | ~50 | 9,000 | ~$0.01 |

**Total estimated monthly cost**: ~$0.02 (negligible)

---

## 14. Monitoring & Analytics

### Translation Usage Tracking

```typescript
// Track which locales are being used
export async function trackLocale(locale: string) {
  await analytics.track('page_view', {
    locale,
    timestamp: new Date().toISOString(),
  });
}

// Dashboard metrics to track:
// - Users per locale
// - Missing translation errors
// - Translation coverage percentage
// - AI translation API usage
```

---

## 15. Mobile App Localization (iOS & Android)

The Listo mobile apps use **Capacitor** with a **Vite + React** build, sharing most components with the web app. This creates both opportunities and challenges for localization.

### Architecture Comparison

| Aspect | Web | Mobile (iOS/Android) |
|--------|-----|----------------------|
| Framework | Next.js 16 (App Router) | Vite + React 19 |
| Router | Next.js App Router | React Router v7 |
| Entry point | `/src/app/layout.tsx` | `/src/main.tsx` |
| i18n Library | `next-intl` | `i18next` + `react-i18next` |
| Locale storage | URL path (`/en/`) | Capacitor Preferences |
| Build output | `.next/` | `dist/` → Capacitor sync |

### Shared Components (Localize Once)

These components are **shared** between web and mobile - localization work benefits both:

```
/src/components/
├── ListContainer.tsx    # Core list UI (~700 lines)
├── ListItem.tsx         # Item rendering (~474 lines)
├── NewItemInput.tsx     # Input with commands (~678 lines)
├── CommandPalette.tsx   # Command modal
├── DictateButton.tsx    # Voice recording
└── ListTitle.tsx        # Title editor
```

**~80% of UI strings** are in shared components.

### Mobile-Specific Strings

```
/src/mobile/
├── pages/
│   ├── Home.tsx         # ~50 strings (PLACEHOLDERS, UI labels)
│   └── List.tsx         # ~30 strings (share options, footer)
└── components/
    └── HomeThemeModal.tsx  # ~15 strings (theme examples)
```

### Platform-Specific Native Strings

#### Android (`/android/app/src/main/res/`)

```xml
<!-- values/strings.xml (English - default) -->
<resources>
    <string name="app_name">Listo</string>
    <string name="title_activity_main">Listo</string>
</resources>

<!-- values-es/strings.xml (Spanish) -->
<resources>
    <string name="app_name">Listo</string>
    <string name="title_activity_main">Listo</string>
</resources>

<!-- values-fr/strings.xml (French) -->
<!-- ... etc for each language -->
```

#### iOS (`/ios/App/App/`)

```
/ios/App/App/
├── Info.plist                    # App metadata
├── en.lproj/
│   └── InfoPlist.strings         # English
├── es.lproj/
│   └── InfoPlist.strings         # Spanish
└── fr.lproj/
    └── InfoPlist.strings         # French
```

```strings
/* en.lproj/InfoPlist.strings */
"NSMicrophoneUsageDescription" = "Listo needs microphone access for voice dictation to create list items";
"CFBundleDisplayName" = "Listo";

/* es.lproj/InfoPlist.strings */
"NSMicrophoneUsageDescription" = "Listo necesita acceso al micrófono para dictado de voz y crear elementos de lista";
"CFBundleDisplayName" = "Listo";
```

### Mobile i18n Setup

Since mobile uses Vite (not Next.js), we use `i18next` + `react-i18next`:

```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

#### Configuration

```typescript
// /src/i18n/mobile.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { Preferences } from '@capacitor/preferences';

// Import all locale files
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import fr from '@/messages/fr.json';

// Custom language detector for Capacitor
const capacitorLanguageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lng: string) => void) => {
    // Check stored preference first
    const { value } = await Preferences.get({ key: 'locale' });
    if (value) {
      callback(value);
      return;
    }
    // Fall back to device language
    const deviceLang = navigator.language.split('-')[0];
    callback(deviceLang);
  },
  init: () => {},
  cacheUserLanguage: async (lng: string) => {
    await Preferences.set({ key: 'locale', value: lng });
  },
};

i18n
  .use(capacitorLanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18n;
```

#### Mobile Entry Point

```typescript
// /src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n/mobile'; // Initialize i18n

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Unified Translation Hook

Create a wrapper that works in both environments:

```typescript
// /src/lib/hooks/useTranslation.ts
import { useCallback } from 'react';

// Detect environment
const isNextJS = typeof window !== 'undefined' &&
                 (window as any).__NEXT_DATA__ !== undefined;

// Web (Next.js) version
let useNextIntl: any;
if (isNextJS) {
  useNextIntl = require('next-intl').useTranslations;
}

// Mobile (i18next) version
let useI18next: any;
if (!isNextJS) {
  useI18next = require('react-i18next').useTranslation;
}

export function useT(namespace?: string) {
  if (isNextJS) {
    // next-intl
    return useNextIntl(namespace);
  } else {
    // react-i18next
    const { t } = useI18next();

    // Wrap to support namespace prefix
    return useCallback((key: string, options?: any) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return t(fullKey, options);
    }, [t, namespace]);
  }
}
```

### Mobile Language Switcher

```typescript
// /src/mobile/components/LanguageSwitcher.tsx
import { useTranslation } from 'react-i18next';
import { Preferences } from '@capacitor/preferences';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const handleChange = async (locale: string) => {
    await i18n.changeLanguage(locale);
    await Preferences.set({ key: 'locale', value: locale });
  };

  return (
    <select
      value={i18n.language}
      onChange={(e) => handleChange(e.target.value)}
      className="bg-transparent border rounded px-2 py-1"
    >
      {LANGUAGES.map(({ code, name, flag }) => (
        <option key={code} value={code}>
          {flag} {name}
        </option>
      ))}
    </select>
  );
}
```

### Build Process Integration

```json
// package.json
{
  "scripts": {
    "i18n:sync": "node scripts/translate-strings.js",
    "i18n:sync-native": "node scripts/sync-native-strings.js",

    "mobile:build": "npm run i18n:sync && vite build",
    "mobile:ios": "npm run mobile:build && npm run i18n:sync-native && cap sync ios && cap open ios",
    "mobile:android": "npm run mobile:build && npm run i18n:sync-native && cap sync android && cap open android"
  }
}
```

### Native String Sync Script

```typescript
// /scripts/sync-native-strings.js
// Syncs translations to native iOS/Android string files

const fs = require('fs');
const path = require('path');

const LOCALES = ['en', 'es', 'fr', 'de'];
const NATIVE_STRINGS = {
  app_name: 'metadata.appName',
  microphone_permission: 'permissions.microphone',
};

async function syncAndroidStrings() {
  for (const locale of LOCALES) {
    const messages = require(`../messages/${locale}.json`);
    const dir = locale === 'en' ? 'values' : `values-${locale}`;
    const filePath = `android/app/src/main/res/${dir}/strings.xml`;

    let xml = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n';
    for (const [androidKey, jsonPath] of Object.entries(NATIVE_STRINGS)) {
      const value = getNestedValue(messages, jsonPath);
      xml += `    <string name="${androidKey}">${escapeXml(value)}</string>\n`;
    }
    xml += '</resources>';

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, xml);
  }
}

async function syncIOSStrings() {
  for (const locale of LOCALES) {
    const messages = require(`../messages/${locale}.json`);
    const dir = `ios/App/App/${locale}.lproj`;
    const filePath = `${dir}/InfoPlist.strings`;

    let content = '';
    content += `"CFBundleDisplayName" = "${messages.metadata.appName}";\n`;
    content += `"NSMicrophoneUsageDescription" = "${messages.permissions.microphone}";\n`;

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content);
  }
}

syncAndroidStrings();
syncIOSStrings();
```

### Mobile Implementation Phases

#### Phase M1: Foundation
- [ ] Install `i18next` and `react-i18next`
- [ ] Create `/src/i18n/mobile.ts` configuration
- [ ] Add Capacitor language detector
- [ ] Initialize in `/src/main.tsx`

#### Phase M2: Component Migration
- [ ] Create unified `useT()` hook
- [ ] Update shared components to use `useT()`
- [ ] Update mobile-specific pages (`Home.tsx`, `List.tsx`)
- [ ] Test on iOS simulator and Android emulator

#### Phase M3: Native Strings
- [ ] Create native string sync script
- [ ] Add Android `values-{lang}/strings.xml` files
- [ ] Add iOS `{lang}.lproj/InfoPlist.strings` files
- [ ] Update build scripts to sync before Capacitor build

#### Phase M4: Testing & Polish
- [ ] Test language switching persists across app restarts
- [ ] Verify App Store / Play Store metadata can be localized
- [ ] Test RTL languages on both platforms
- [ ] Performance testing (bundle size with all locales)

### App Store Localization

#### iOS App Store Connect
- Localize app name, subtitle, description, keywords
- Screenshots for each language
- What's New text per language

#### Google Play Console
- Localize store listing (title, short/full description)
- Screenshots and feature graphics per language
- Release notes per language

### Mobile-Specific Considerations

1. **Bundle Size**: All locale JSON files are bundled into the app
   - Consider lazy loading for less common languages
   - Current estimate: ~5KB per language (minimal impact)

2. **Offline Support**: Translations work offline (bundled, not fetched)

3. **Deep Links**: Keep list URLs language-agnostic (`listo.to/abc123`)
   - Language is stored in device preferences, not URL

4. **App Updates**: New translations require app update
   - Consider remote config for critical string updates

---

## Summary

This strategy provides:

1. **Sustainability**: Automated workflows, CI/CD integration, minimal manual effort
2. **Expandability**: Easy to add new languages, new strings auto-translated
3. **SEO Optimization**: Proper hreflang, sitemaps, locale URLs, SSR (web)
4. **AI Integration**: Gemini-powered auto-translation, language-aware AI responses
5. **Developer Experience**: Type-safe translations, pre-commit hooks, clear conventions
6. **Cross-Platform**: Unified approach for web, iOS, and Android with shared components

### Platform-Specific Libraries

| Platform | Library | Locale Storage |
|----------|---------|----------------|
| Web | `next-intl` | URL path (`/en/`) |
| iOS/Android | `i18next` | Capacitor Preferences |
| Native strings | Sync script | Platform-specific files |

The estimated implementation time is 5-6 weeks for full rollout across all platforms, with ongoing maintenance being largely automated.
