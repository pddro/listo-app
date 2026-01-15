# Changelog

All notable changes to Listo will be documented in this file.

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

- **UI/UX**
  - Clean, minimalist design with primary blue (#47A1FF)
  - New items appear at top of list
  - Completed items move to bottom after animation
  - Sparkle particle effect on item completion
  - Flash animation for newly added items
  - Optimistic UI updates for instant feedback
  - Mobile-friendly responsive layout

### Technical
- Next.js 14 with App Router
- Supabase for database and real-time sync
- Google Gemini AI for item generation and list manipulation
- @dnd-kit for drag and drop
- TypeScript throughout
