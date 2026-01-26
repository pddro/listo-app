const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read env file
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL_DEV,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV
);

const templates = [
  {
    id: 'test02',
    title: 'Weekly Grocery Shopping',
    description: 'Essential groceries for a healthy week',
    category: 'shopping',
    theme: {
      primary: '#22C55E',
      primaryDark: '#16A34A',
      primaryLight: '#86EFAC',
      primaryPale: '#F0FDF4',
      primaryGlow: 'rgba(34, 197, 94, 0.4)',
      textPrimary: '#1F2937',
      textSecondary: '#4B5563',
      textMuted: '#9CA3AF',
      textPlaceholder: '#D1D5DB',
      bgPrimary: '#F0FDF4',
      bgSecondary: '#DCFCE7',
      bgHover: '#BBF7D0',
      borderLight: '#BBF7D0',
      borderMedium: '#86EFAC',
      error: '#EF4444'
    },
    items: [
      { content: '#Produce', position: 0 },
      { content: 'Bananas', position: 1, parent: '#Produce' },
      { content: 'Apples', position: 2, parent: '#Produce' },
      { content: 'Spinach', position: 3, parent: '#Produce' },
      { content: 'Tomatoes', position: 4, parent: '#Produce' },
      { content: 'Onions', position: 5, parent: '#Produce' },
      { content: '#Dairy', position: 6 },
      { content: 'Milk', position: 7, parent: '#Dairy' },
      { content: 'Eggs', position: 8, parent: '#Dairy' },
      { content: 'Cheese', position: 9, parent: '#Dairy' },
      { content: 'Yogurt', position: 10, parent: '#Dairy' },
      { content: '#Proteins', position: 11 },
      { content: 'Chicken breast', position: 12, parent: '#Proteins' },
      { content: 'Ground beef', position: 13, parent: '#Proteins' },
      { content: 'Salmon', position: 14, parent: '#Proteins' },
      { content: '#Pantry', position: 15 },
      { content: 'Rice', position: 16, parent: '#Pantry' },
      { content: 'Pasta', position: 17, parent: '#Pantry' },
      { content: 'Olive oil', position: 18, parent: '#Pantry' },
    ]
  },
  {
    id: 'test03',
    title: 'Morning Routine',
    description: 'Start your day right with this daily checklist',
    category: 'productivity',
    theme: {
      primary: '#8B5CF6',
      primaryDark: '#7C3AED',
      primaryLight: '#A78BFA',
      primaryPale: '#EDE9FE',
      primaryGlow: 'rgba(139, 92, 246, 0.4)',
      textPrimary: '#1F2937',
      textSecondary: '#4B5563',
      textMuted: '#9CA3AF',
      textPlaceholder: '#D1D5DB',
      bgPrimary: '#F5F3FF',
      bgSecondary: '#EDE9FE',
      bgHover: '#DDD6FE',
      borderLight: '#DDD6FE',
      borderMedium: '#C4B5FD',
      error: '#EF4444'
    },
    items: [
      { content: 'Wake up at 6:30 AM', position: 0 },
      { content: 'Drink a glass of water', position: 1 },
      { content: 'Stretch for 5 minutes', position: 2 },
      { content: 'Shower', position: 3 },
      { content: 'Skincare routine', position: 4 },
      { content: 'Get dressed', position: 5 },
      { content: 'Make bed', position: 6 },
      { content: 'Prepare breakfast', position: 7 },
      { content: 'Review daily goals', position: 8 },
      { content: 'Check calendar', position: 9 },
      { content: 'Leave on time', position: 10 },
    ]
  },
  {
    id: 'test04',
    title: 'Birthday Party Planning',
    description: 'Everything you need for an amazing celebration',
    category: 'events',
    theme: {
      primary: '#EC4899',
      primaryDark: '#DB2777',
      primaryLight: '#F472B6',
      primaryPale: '#FCE7F3',
      primaryGlow: 'rgba(236, 72, 153, 0.4)',
      textPrimary: '#1F2937',
      textSecondary: '#4B5563',
      textMuted: '#9CA3AF',
      textPlaceholder: '#D1D5DB',
      bgPrimary: '#FDF2F8',
      bgSecondary: '#FCE7F3',
      bgHover: '#FBCFE8',
      borderLight: '#FBCFE8',
      borderMedium: '#F9A8D4',
      error: '#EF4444'
    },
    items: [
      { content: '#Planning', position: 0 },
      { content: 'Set date and time', position: 1, parent: '#Planning' },
      { content: 'Create guest list', position: 2, parent: '#Planning' },
      { content: 'Send invitations', position: 3, parent: '#Planning' },
      { content: 'Book venue (if needed)', position: 4, parent: '#Planning' },
      { content: '#Decorations', position: 5 },
      { content: 'Balloons', position: 6, parent: '#Decorations' },
      { content: 'Banner', position: 7, parent: '#Decorations' },
      { content: 'Streamers', position: 8, parent: '#Decorations' },
      { content: 'Table centerpieces', position: 9, parent: '#Decorations' },
      { content: '#Food & Drinks', position: 10 },
      { content: 'Order/bake cake', position: 11, parent: '#Food & Drinks' },
      { content: 'Snacks and appetizers', position: 12, parent: '#Food & Drinks' },
      { content: 'Beverages', position: 13, parent: '#Food & Drinks' },
      { content: 'Plates and utensils', position: 14, parent: '#Food & Drinks' },
      { content: '#Activities', position: 15 },
      { content: 'Plan games', position: 16, parent: '#Activities' },
      { content: 'Create playlist', position: 17, parent: '#Activities' },
      { content: 'Prepare party favors', position: 18, parent: '#Activities' },
    ]
  }
];

async function createTemplate(template) {
  // Check if already exists
  const { data: existing } = await supabase
    .from('lists')
    .select('id')
    .eq('id', template.id)
    .single();

  if (existing) {
    console.log(`Template ${template.id} already exists, deleting...`);
    await supabase.from('items').delete().eq('list_id', template.id);
    await supabase.from('lists').delete().eq('id', template.id);
  }

  // Create the template
  const { error: listError } = await supabase
    .from('lists')
    .insert({
      id: template.id,
      title: template.title,
      is_template: true,
      template_description: template.description,
      template_category: template.category,
      language: 'en',
      use_count: Math.floor(Math.random() * 100) + 10,
      is_official: true,
      status: 'approved',
      theme: template.theme
    });

  if (listError) {
    console.error(`List error for ${template.id}:`, listError);
    return false;
  }

  // Create headers first
  const idMapping = {};
  for (const item of template.items) {
    if (item.content.startsWith('#')) {
      const { data, error } = await supabase
        .from('items')
        .insert({
          list_id: template.id,
          content: item.content,
          completed: false,
          parent_id: null,
          position: item.position,
        })
        .select()
        .single();

      if (error) {
        console.error('Header error:', error);
      } else {
        idMapping[item.content] = data.id;
      }
    }
  }

  // Create child items
  for (const item of template.items) {
    if (!item.content.startsWith('#')) {
      const parentId = item.parent ? idMapping[item.parent] : null;
      const { error } = await supabase
        .from('items')
        .insert({
          list_id: template.id,
          content: item.content,
          completed: false,
          parent_id: parentId,
          position: item.position,
        });

      if (error) {
        console.error('Item error:', error);
      }
    }
  }

  console.log(`✓ Created: ${template.title} (${template.id})`);
  return true;
}

async function main() {
  console.log('Creating templates...\n');

  for (const template of templates) {
    await createTemplate(template);
  }

  console.log('\nDone! View at: http://localhost:3001/en/templates');
}

main().catch(console.error);
