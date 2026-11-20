/**
 * Editorial Neobrutalisme design tokens for UrusJakarta.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Palette = {
  canvas: '#F4F1EA',
  surface: '#FFFFFF',
  surfaceAlt: '#F9FAFB',
  highlight: '#FFFBEB',
  ink: '#111827',
  inkMuted: '#4B5563',
  inkSubtle: '#6B7280',
  accent: '#FF5E00',
  accentText: '#FFFFFF',
  yellow: '#FDE047',
  warning: '#FACC15',
  pending: '#FDBA74',
  success: '#86EFAC',
  lime: '#D9F99D',
  danger: '#FCA5A5',
  dangerSolid: '#DC2626',
} as const;

export const Colors = {
  light: {
    text: Palette.ink,
    background: Palette.canvas,
    backgroundElement: Palette.surface,
    backgroundSelected: Palette.yellow,
    textSecondary: Palette.inkMuted,
    border: Palette.ink,
    accent: Palette.accent,
  },
  dark: {
    text: Palette.ink,
    background: Palette.canvas,
    backgroundElement: Palette.surface,
    backgroundSelected: Palette.yellow,
    textSecondary: Palette.inkMuted,
    border: Palette.ink,
    accent: Palette.accent,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BrutalShadow = {
  sm: {
    shadowColor: Palette.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  md: {
    shadowColor: Palette.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  lg: {
    shadowColor: Palette.ink,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 720;
