'use client';

import { Template } from '@/types';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

interface TemplateCardProps {
  template: Template;
}

export function TemplateCard({ template }: TemplateCardProps) {
  const t = useTranslations('templates');

  // Get primary color from theme for visual preview
  const primaryColor = template.theme?.primary || '#3B82F6';
  const bgColor = template.theme?.bgPrimary || '#F8FAFC';

  return (
    <Link
      href={`/templates/${template.id}`}
      className="group block rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:shadow-md"
    >
      {/* Theme preview strip */}
      <div
        className="mb-3 h-2 w-full rounded-full"
        style={{ backgroundColor: primaryColor }}
      />

      {/* Title */}
      <h3 className="mb-1 text-base font-semibold text-gray-900 group-hover:text-blue-600">
        {template.title}
      </h3>

      {/* Description */}
      {template.template_description && (
        <p className="mb-3 line-clamp-2 text-sm text-gray-600">
          {template.template_description}
        </p>
      )}

      {/* Footer: category + use count */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 capitalize">
          {t(`categories.${template.template_category}`)}
        </span>
        <span>
          {template.use_count.toLocaleString()} {t('usedTimes')}
        </span>
      </div>
    </Link>
  );
}
