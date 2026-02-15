import { ThemeColors } from '@/lib/gemini';
import { FirecrawlColors } from '@/types';

// Parse hex color to RGB components
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  const num = parseInt(cleaned, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

// Convert RGB back to hex
function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((c) => {
        const clamped = Math.max(0, Math.min(255, Math.round(c)));
        return clamped.toString(16).padStart(2, '0');
      })
      .join('')
  );
}

// Darken a hex color by a percentage (0-100)
function darken(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const factor = 1 - percent / 100;
  return rgbToHex(r * factor, g * factor, b * factor);
}

// Lighten a hex color by mixing with white
function lighten(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const factor = percent / 100;
  return rgbToHex(
    r + (255 - r) * factor,
    g + (255 - g) * factor,
    b + (255 - b) * factor
  );
}

// Create rgba string from hex + alpha
function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Mix two hex colors
function mixColors(hex1: string, hex2: string, weight: number): string {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  return rgbToHex(
    c1.r * weight + c2.r * (1 - weight),
    c1.g * weight + c2.g * (1 - weight),
    c1.b * weight + c2.b * (1 - weight)
  );
}

/**
 * Convert Firecrawl branding colors into a full ThemeColors palette.
 * All derivation is algorithmic — no AI call needed.
 */
export function firecrawlToTheme(colors: FirecrawlColors): ThemeColors {
  const primary = colors.primary;
  const bg = colors.background || '#FFFFFF';
  const textMain = colors.textPrimary || '#1A1A1A';
  const textSec = colors.textSecondary || '#6B7280';

  return {
    primary,
    primaryDark: darken(primary, 15),
    primaryLight: rgba(primary, 0.2),
    primaryPale: rgba(primary, 0.1),
    primaryGlow: rgba(primary, 0.4),
    textPrimary: textMain,
    textSecondary: textSec,
    textMuted: lighten(textSec, 20),
    textPlaceholder: lighten(textSec, 35),
    bgPrimary: bg,
    bgSecondary: darken(bg, 3),
    bgHover: darken(bg, 5),
    borderLight: mixColors(textMain, bg, 0.1),
    borderMedium: mixColors(textMain, bg, 0.2),
    error: '#dc2626',
  };
}
