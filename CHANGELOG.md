# Changelog

All notable changes to Listo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- **Templates Feature**
  - Community templates gallery at `/templates` with category filtering and search
  - Individual template landing pages with SEO metadata for Google discovery
  - "Use Template" creates a fresh copy with all items unchecked
  - "Save as Template" from any list to submit for community review
  - Admin review page at `/admin/templates?secret=xxx` for approve/reject workflow
  - AI translation endpoint to translate official templates to all 9 languages
  - Templates tracked by `use_count` to show popularity
  - Browse Templates link on home page
  - Full i18n support for templates UI in all 9 locales
  - Database: New `templates` and `template_items` tables with migration SQL
  - Mobile: Community templates browsing page with category filters
  - Mobile: Template detail page with preview and "Use Template" functionality
  - Mobile: Personal templates hook using Capacitor Preferences storage
  - Mobile: "Browse Community Templates" button on Home screen
  - Analytics tracking for template usage

- **Delightful UX Architecture (Mobile)**
  - Added `AppStateContext` for global state management and list caching
  - Persistent background layer prevents white flash during navigation
  - Home theme stored in memory for instant synchronous access on back navigation
  - Lists are preloaded when visible on Home screen for instant loading
  - `useList` hook accepts initial data from cache for zero-loading-state transitions

- **Localization Infrastructure (Phase 1)**
  - Installed `next-intl` for internationalization support
  - Created locale configuration (`src/i18n/config.ts`) with 8 supported languages
  - Set up `[locale]` route structure for path-based localization (`/en/`, `/es/`, etc.)
  - Added middleware for automatic language detection from browser
  - Created initial English translation file (`messages/en.json`) with ~200 strings
  - Added hreflang alternate links for SEO
  - Created localized navigation utilities (`src/i18n/navigation.ts`)

### Fixed
- iOS audio recording now properly detects supported MIME types (fixes transcription on iOS)

---

## [0.2.1] - 2025-01-17

### Added
- **Enhanced Category Drag UX**
  - Group highlight now encompasses entire category (header + all children)
  - Deck of cards effect when dragging categories - children stack visually behind header
  - Item count badge shown on category drag preview
- **Smart Drag Behavior**
  - Root items no longer disturb group children when dragging over categories
  - Invisible drop zones at top/bottom for moving items out of groups
  - Pointer-based detection for intuitive drop targeting

### Fixed
- **AI Manipulation** (`!` command) now preserves group structure
  - Items stay in their categories when using commands like `!add emoji prefix`
  - AI receives and respects `parent_id` for grouped items
  - Only reorganizes groups when explicitly requested

---

## [0.2.0] - 2025-01-17

### Added
- **Text Commands** - Quick list manipulation via `--` prefix
  - `--complete` / `--reset` - Complete or reset all items
  - `--clean` / `--clear` - Delete completed items
  - `--large` / `--normal` - Toggle 2x display size
  - `--emojify` - Toggle auto-emoji prefix for new items
  - `--sort` / `--sort all` - Alphabetical sorting
  - `--ungroup` - Remove all categories
  - `--title` - AI-generate list title
  - `--nuke` - Delete all items
- **Emojify Mode** - Automatically adds relevant emoji to new items using Gemini
- **Title Generation** - AI generates list title from item contents
- **Commands Reference** - Always-visible command list at bottom of list view
- **Active Modes Indicator** - Shows which modes are enabled (large, emojify)
- `/api/emojify` endpoint (Gemini Flash Lite, 4 max tokens)
- `/api/title` endpoint (Gemini Flash Lite, 20 max tokens)

### Changed
- Increased bottom padding for mobile-friendly spacing
- Commands shown in lowercase in reference for clarity

### Database Migrations Required
```sql
ALTER TABLE lists ADD COLUMN large_mode BOOLEAN DEFAULT NULL;
ALTER TABLE lists ADD COLUMN emojify_mode BOOLEAN DEFAULT NULL;
```

---

## [0.1.1] - 2025-01-17

### Added
- **AI-Generated Themes** - Type `theme:` or `style:` followed by description
  - Generates complete color palette via Gemini
  - Persists per-list in database
  - Reset theme option in Power Features menu
- Theme colors applied via CSS variables
- `/api/theme` endpoint

### Changed
- Updated all components to use CSS variables for theming
- ListTitle now respects theme colors

### Database Migrations Required
```sql
ALTER TABLE lists ADD COLUMN theme JSONB DEFAULT NULL;
```

---

## [0.1.0] - 2025-01-15 (Beta)

### Added
- **Core List Functionality**
  - Create and manage shareable checklists with unique URLs
  - Real-time collaboration via Supabase subscriptions
  - Add single items or bulk add with comma-separated values
  - Check/uncheck items with sparkle animation
  - Edit items inline by clicking on them
  - Delete items (backspace on empty or edit to empty)
  - Drag and drop reordering with @dnd-kit

- **Category System**
  - Create headers/categories using `#` prefix (e.g., `#Groceries`)
  - Drag items into categories to group them
  - Drag items out of categories to ungroup
  - Visual highlighting when dragging over categories
  - Hashtag icon for category headers

- **AI Integration (Google Gemini)**
  - Generate items with `...` prefix (e.g., `...camping essentials`)
  - Smart categorization detection (e.g., `...groceries categorized by aisle`)
  - Reorganize existing lists with `!` prefix (e.g., `!sort by priority`)

- **Audio Dictation**
  - Voice input via microphone button
  - AssemblyAI for speech-to-text transcription
  - Transcriptions processed by Gemini for item extraction

- **UI/UX**
  - Clean, minimalist design with primary blue (#47A1FF)
  - New items appear at top of list
  - Completed items move to bottom after animation
  - Sparkle particle effect on item completion
  - Flash animation for newly added items
  - Optimistic UI updates for instant feedback
  - Mobile-friendly responsive layout
  - Power Features menu (lightning bolt icon)

### Technical
- Next.js 16 with App Router
- React 19
- Tailwind CSS 4
- Supabase for database and real-time sync
- Google Gemini AI for item generation and list manipulation
- AssemblyAI for audio transcription
- @dnd-kit for drag and drop
- TypeScript throughout
