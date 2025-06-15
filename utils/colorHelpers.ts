/**
 * Color helper utilities for color manipulation and accessibility (functional, pure, immutable).
 * @module colorHelpers
 */

/** RGB color object. */
export type RGB = Readonly<{ r: number; g: number; b: number }>;

/**
 * Convert hex → RGB, supports shorthand (#abc).
 * Pure, immutable, functional.
 * @param hex - Hex color string
 * @returns RGB object or null if invalid
 * @example
 * hexToRgb('#fff'); // { r: 255, g: 255, b: 255 }
 */
export const hexToRgb = (hex: string): RGB | null => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const match = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(full);
  return match
    ? { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) } as const
    : null;
};

/**
 * WCAG‑relative luminance (pure, functional).
 * @param rgb - RGB color object
 * @returns Relative luminance value
 */
export const luminance = ({ r, g, b }: RGB): number => {
  const chan = (v: number): number => {
    const norm = v / 255;
    return norm <= 0.03928 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
};

/**
 * Contrast ratio of two hex colours (pure, functional).
 * @param a - First hex color
 * @param b - Second hex color
 * @returns Contrast ratio
 */
export const contrast = (a: string, b: string): number => {
  const rgb1 = hexToRgb(a);
  const rgb2 = hexToRgb(b);
  if (!rgb1 || !rgb2) return 1;
  const [l1, l2] = [luminance(rgb1), luminance(rgb2)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/**
 * Choose white/black text meeting 4.5 contrast (pure, functional).
 * @param bg - Background hex color
 * @returns Hex color for readable text
 */
export const readableText = (bg: string): '#ffffff' | '#121212' =>
  contrast(bg, '#ffffff') >= 4.5 ? '#ffffff' : '#121212';

/**
 * Lighten (+) / darken (−) hex colour by % value (pure, functional).
 * @param hex - Hex color string
 * @param pct - Percentage to adjust (positive to lighten, negative to darken)
 * @returns Adjusted hex color
 */
export const adjustColor = (hex: string, pct: number): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const p = pct / 100;
  const adj = (v: number): number => Math.round(Math.min(255, Math.max(0, v + v * p)));
  const toHex = (v: number): string => v.toString(16).padStart(2, '0');
  return `#${[adj(rgb.r), adj(rgb.g), adj(rgb.b)].map(toHex).join('')}`;
}; 