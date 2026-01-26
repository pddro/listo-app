'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

interface UseTemplateButtonProps {
  templateId: string;
}

export function UseTemplateButton({ templateId }: UseTemplateButtonProps) {
  const t = useTranslations('templates');
  const router = useRouter();
  const [isUsing, setIsUsing] = useState(false);

  const handleUseTemplate = async () => {
    if (isUsing) return;

    setIsUsing(true);

    try {
      const response = await fetch(`/api/templates/${templateId}/use`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to use template');
      }

      // Navigate to the new list
      router.push(`/${data.list_id}`);
    } catch (error) {
      console.error('Use template error:', error);
      setIsUsing(false);
      // Could add toast notification here
    }
  };

  return (
    <button
      onClick={handleUseTemplate}
      disabled={isUsing}
      className="w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isUsing ? t('using') : t('useTemplate')}
    </button>
  );
}
