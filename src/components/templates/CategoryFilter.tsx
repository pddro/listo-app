'use client';

import { TemplateCategory, TEMPLATE_CATEGORIES } from '@/types';
import { useTranslations } from 'next-intl';

interface CategoryFilterProps {
  selectedCategory: TemplateCategory | null;
  onSelectCategory: (category: TemplateCategory | null) => void;
}

export function CategoryFilter({ selectedCategory, onSelectCategory }: CategoryFilterProps) {
  const t = useTranslations('templates');

  return (
    <div className="flex flex-wrap gap-2">
      {/* All category */}
      <button
        onClick={() => onSelectCategory(null)}
        className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
          selectedCategory === null
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {t('categories.all')}
      </button>

      {/* Category pills */}
      {TEMPLATE_CATEGORIES.map((category) => (
        <button
          key={category}
          onClick={() => onSelectCategory(category)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            selectedCategory === category
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {t(`categories.${category}`)}
        </button>
      ))}
    </div>
  );
}
