'use client';

import { generateListId } from '@/lib/utils/generateId';
import { useRouter } from '@/i18n/navigation';

export default function NotFound() {
  const router = useRouter();

  const handleCreateList = () => {
    const newListId = generateListId();
    router.push(`/${newListId}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="text-center max-w-md">
        <h1
          className="text-6xl font-bold mb-4"
          style={{ color: 'var(--text-muted)' }}
        >
          404
        </h1>
        <p
          className="text-xl mb-8"
          style={{ color: 'var(--text-secondary)' }}
        >
          This page doesn't exist
        </p>
        <button
          onClick={handleCreateList}
          className="text-white font-medium py-3 px-6 rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--primary)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-dark)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--primary)'}
        >
          Create a New List
        </button>
      </div>
    </div>
  );
}
