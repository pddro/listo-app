'use client';

import { useEffect, useState } from 'react';
import './MangoRain.css';

interface MangoRainProps {
  active: boolean;
  onComplete?: () => void;
}

interface Mango {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

export default function MangoRain({ active, onComplete }: MangoRainProps) {
  const [mangos, setMangos] = useState<Mango[]>([]);

  useEffect(() => {
    if (active) {
      // Generate mangos with random positions and timings
      const newMangos: Mango[] = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 1.5 + Math.random() * 1,
        size: 24 + Math.random() * 20,
        rotation: Math.random() * 360,
      }));
      setMangos(newMangos);

      // Clear after animation completes
      const timeout = setTimeout(() => {
        setMangos([]);
        onComplete?.();
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [active, onComplete]);

  if (mangos.length === 0) return null;

  return (
    <div className="mango-rain-container">
      {mangos.map((mango) => (
        <div
          key={mango.id}
          className="mango"
          style={{
            left: `${mango.left}%`,
            animationDelay: `${mango.delay}s`,
            animationDuration: `${mango.duration}s`,
            fontSize: `${mango.size}px`,
            '--rotation': `${mango.rotation}deg`,
          } as React.CSSProperties}
        >
          🥭
        </div>
      ))}
    </div>
  );
}
