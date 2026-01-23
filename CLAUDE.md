# Listo - Project Guidelines

## Security & Workflow (CRITICAL)

### Git Workflow
1. **ALWAYS create a new branch** before starting any work
   - Never commit directly to `main` unless explicitly instructed
   - Branch naming: `feature/`, `fix/`, `refactor/` prefixes
2. **Merge to main** only when the user explicitly requests it
3. **Run `npm run build`** before committing to ensure no TypeScript errors

### Changelog
- **ALWAYS update CHANGELOG.md** when adding features, fixing bugs, or making changes
- Follow Keep a Changelog format
- Include database migration notes when schema changes

### Environment Variables
- Never commit `.env` files
- Required env vars: `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Project Overview

**Listo** is an AI-powered, shareable checklist app. Lists are identified by URL (e.g., `/abc123`) and can be shared with anyone - no authentication required.

### Purpose
- Simple, fast list creation and sharing
- AI-enhanced list management (generation, organization, theming)
- Mobile-first design with plans for native iOS/Android apps

---

## Technology Stack

### Current (Web)
- **Framework**: Next.js 16 (App Router) with React 19
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **AI**: Google Gemini API (`@google/genai`)
  - `gemini-3-flash-preview` for complex tasks
  - `gemini-2.0-flash-lite` for cheap/fast tasks (emoji, title generation)
- **Drag & Drop**: dnd-kit
- **IDs**: nanoid

### Mobile (iOS/Android)
- **Framework**: Vite + Capacitor (NOT Next.js!)
- Same Supabase backend
- Native audio recording for dictation
- Source: `src/mobile/` directory

**IMPORTANT - Separate Build Systems:**
- **Web**: `npm run build` (Next.js)
- **Mobile**: `npm run mobile:build` (Vite)
- **Mobile + Sync**: `npm run mobile:sync` (builds and syncs to iOS/Android)

When making changes to mobile code, you MUST run `npm run mobile:build` or `npm run mobile:sync`, NOT `npm run build`.

---

## AI Integration Points

### 1. Item Generation (`/api/ai`)
- Prefix: `...` (e.g., `...ingredients for tacos`)
- Generates list items from natural language
- Supports categorization when keywords detected

### 2. List Manipulation (`!` prefix)
- Reorganizes existing items based on instructions
- Can create category headers (`#Category`)
- Examples: `!sort by priority`, `!group by aisle`

### 3. Theme Generation (`/api/theme`)
- Prefix: `theme:` or `style:`
- Generates complete color palette from description
- Applies via CSS variables

### 4. Emojify (`/api/emojify`)
- Toggle: `--emojify` command
- Auto-adds relevant emoji to new items
- Uses cheapest model with 4 max tokens

### 5. Title Generation (`/api/title`)
- Command: `--title`
- Generates list title from item contents
- Uses cheap model with 20 max tokens

### 6. Audio Dictation (`/api/transcribe`)
- Uses AssemblyAI for speech-to-text
- Transcription sent to Gemini for item extraction

---

## Text Commands

All commands start with `--` and are case-insensitive:

| Command | Description |
|---------|-------------|
| `--complete` | Complete all items |
| `--reset` | Reset all items to incomplete |
| `--clean` / `--clear` | Delete all completed items |
| `--large` / `--big` | Enable 2x larger display |
| `--normal` / `--small` | Disable large mode |
| `--emojify` | Toggle auto-emoji for new items |
| `--sort` | Sort items within groups |
| `--sort all` | Sort everything including groups |
| `--ungroup` / `--flatten` | Remove all categories |
| `--title` | AI-generate list title |
| `--nuke` | Delete ALL items |

---

## Database Schema

### `lists` table
```sql
id          TEXT PRIMARY KEY
title       TEXT
theme       JSONB           -- ThemeColors object
large_mode  BOOLEAN
emojify_mode BOOLEAN
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

### `items` table
```sql
id          UUID PRIMARY KEY
list_id     TEXT REFERENCES lists(id)
content     TEXT
completed   BOOLEAN
parent_id   UUID            -- For nested items under headers
position    INTEGER         -- Sort order
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

---

## Key Files

- `src/app/[listId]/page.tsx` - Main list view
- `src/lib/hooks/useList.ts` - List state management & Supabase operations
- `src/lib/hooks/useAI.ts` - AI hook for client-side
- `src/lib/gemini.ts` - Gemini API functions
- `src/components/NewItemInput.tsx` - Input with command detection
- `src/components/ListItem.tsx` - Individual item rendering
- `src/components/ListContainer.tsx` - List with drag-and-drop

---

## Conventions

- Headers/categories start with `#` (e.g., `#Groceries`)
- Items under headers have `parent_id` set to header's ID
- Completed items sort to bottom
- Real-time sync via Supabase subscriptions
- Optimistic updates for snappy UX
