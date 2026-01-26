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

// Use DEV env vars
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL_DEV,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV
);

async function createTestTemplate() {
  const templateId = 'test01';

  // Check if already exists
  const { data: existing } = await supabase
    .from('lists')
    .select('id')
    .eq('id', templateId)
    .single();

  if (existing) {
    console.log('Template already exists, deleting first...');
    await supabase.from('items').delete().eq('list_id', templateId);
    await supabase.from('lists').delete().eq('id', templateId);
  }

  // Create the template (a list with is_template = true)
  const { error: listError } = await supabase
    .from('lists')
    .insert({
      id: templateId,
      title: 'Weekend Trip Packing',
      is_template: true,
      template_description: 'Essential items for a quick weekend getaway',
      template_category: 'travel',
      language: 'en',
      use_count: 42,
      is_official: true,
      status: 'approved',
      theme: {
        primary: '#F97316',
        primaryDark: '#EA580C',
        primaryLight: '#FDBA74',
        primaryPale: '#FFF7ED',
        primaryGlow: 'rgba(249, 115, 22, 0.4)',
        textPrimary: '#1F2937',
        textSecondary: '#4B5563',
        textMuted: '#9CA3AF',
        textPlaceholder: '#D1D5DB',
        bgPrimary: '#FFF7ED',
        bgSecondary: '#FFEDD5',
        bgHover: '#FED7AA',
        borderLight: '#FED7AA',
        borderMedium: '#FDBA74',
        error: '#EF4444'
      }
    });

  if (listError) {
    console.error('List error:', listError);
    return;
  }

  // Create items
  const items = [
    { content: '#Clothing', position: 0 },
    { content: 'T-shirts (3)', position: 1, parent: '#Clothing' },
    { content: 'Pants/shorts (2)', position: 2, parent: '#Clothing' },
    { content: 'Underwear & socks', position: 3, parent: '#Clothing' },
    { content: 'Pajamas', position: 4, parent: '#Clothing' },
    { content: '#Toiletries', position: 5 },
    { content: 'Toothbrush & toothpaste', position: 6, parent: '#Toiletries' },
    { content: 'Deodorant', position: 7, parent: '#Toiletries' },
    { content: 'Shampoo (travel size)', position: 8, parent: '#Toiletries' },
    { content: '#Electronics', position: 9 },
    { content: 'Phone charger', position: 10, parent: '#Electronics' },
    { content: 'Headphones', position: 11, parent: '#Electronics' },
    { content: 'Power bank', position: 12, parent: '#Electronics' },
    { content: '#Documents', position: 13 },
    { content: 'ID/Passport', position: 14, parent: '#Documents' },
    { content: 'Booking confirmations', position: 15, parent: '#Documents' },
  ];

  // First pass: create headers and build ID mapping
  const idMapping = {};

  for (const item of items) {
    if (item.content.startsWith('#')) {
      const { data, error } = await supabase
        .from('items')
        .insert({
          list_id: templateId,
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

  // Second pass: create child items
  for (const item of items) {
    if (!item.content.startsWith('#')) {
      const parentId = item.parent ? idMapping[item.parent] : null;
      const { error } = await supabase
        .from('items')
        .insert({
          list_id: templateId,
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

  console.log('✓ Test template created!');
  console.log('  ID:', templateId);
  console.log('  View at: http://localhost:3001/en/templates/' + templateId);
}

createTestTemplate().catch(console.error);
