/**
 * theme/Colors.ts
 * Full, backward-compatible colour system.
 * -----------------------------------------------------------------------
 *  – All original constants preserved.
 *  – New 50-steps + functional palettes added.
 *  – Greys subtly tinted with brand blue (≈205°) for harmony.
 */

export const tintColorLight = '#007aff';
export const tintColorDark  = '#ffffff';

// iA Writer inspiration – kept for optional use
export const iAWriterBlue   = '#00bfff';
export const iADarkBg       = '#1a1a1a';
export const iADarkText     = '#d1d1d1';
export const iADarkSecondary= '#8e8e93';
export const iADarkBorder   = '#3a3a3c';
export const iALightBg      = '#f8f8f8';
export const iALightText    = '#333333';
export const iALightSecondary='#8e8e93';
export const iALightBorder  = '#d1d1d1';

// ─── Brand palettes ───────────────────────────────────────────────────────
export const primary   = { 50:'#eff8ff',100:'#dbeffe',200:'#b7dffe',300:'#7fc7fd',400:'#38bdf8',
  500:'#0ea5e9',600:'#0284c7',700:'#0369a1',800:'#075985',900:'#0c4a6e' };

export const secondary = { 50:'#eaf8f9',100:'#d2f1f3',200:'#a6e3e7',300:'#72d2d9',400:'#40b8c7',
  500:'#1ba8bc',600:'#1791a3',700:'#147a8a',800:'#106372',900:'#0d4f5a' };

// ─── Blue-tinted neutral ramp (4-8 % hue shift) ───────────────────────────
export const grey = {
  50:'#f5f9fc',100:'#eef5fa',200:'#dfe8f1',300:'#c8d4de',400:'#aebbc6',
  500:'#8d9aa5',600:'#6f7d89',700:'#56616e',800:'#3c4753',900:'#252f37',
};
/** Alias for clarity; either name is valid. */
export const neutral = grey;

// ─── Functional palettes (kept + new) ─────────────────────────────────────
export const success = { 50:'#ecfdf4',100:'#d1fae3',200:'#a6f4c5',300:'#6ee7a3',400:'#34d399',
  500:'#22c55e',600:'#16a34a',700:'#15803d',800:'#166534',900:'#14532d' };

export const alert   = { 50:'#fef2f2',100:'#fee2e2',200:'#fecaca',300:'#fca5a5',400:'#f87171',
  500:'#ef4444',600:'#dc2626',700:'#b91c1c',800:'#991b1b',900:'#7f1d1d' };

export const warning = { 50:'#fffbea',100:'#fff3c4',200:'#ffe69a',300:'#ffd66e',400:'#ffc447',
  500:'#fca609',600:'#da8600',700:'#b36b00',800:'#8e5400',900:'#6c4100' };

export const info    = { 50:'#e6faff',100:'#c5f4ff',200:'#9aebff',300:'#66defe',400:'#2fd0ff',
  500:'#06b6d4',600:'#0493b2',700:'#04738f',800:'#065a72',900:'#06445a' };

// ─── Theme objects (all previous keys retained) ──────────────────────────
export const Colors = {
  light: {
    text: grey[800],
    background: grey[50],
    tint: primary[500],
    icon: grey[500],
    tabIconDefault: grey[500],
    tabIconSelected: primary[600],
    border: grey[200],
    card: '#ffffff',
    primary: primary[500],
    secondary: secondary[500],
    error: alert[600],
    success: success[600],
    /** new functional colours */
    warning: warning[600],
    info: info[500],
    notification: alert[500],
    disabledInputBackground: grey[100],
    disabledInputText: grey[400],
    cardHeader: grey[50],
    inputBackground: '#ffffff',
    warningBackground: warning[100],
    warningText: warning[800],
    bottomSheetHandle: grey[400],
    bottomSheetBackground: '#ffffff',
    shadow: 'rgba(0,0,0,0.12)',
    iconShadow: '#ffffff',

        /** 6 subtle label colours (background) */
        labels: [
          primary[100],   // #DBEFFE – soft blue
          secondary[100], // #D2F1F3 – soft petrol
          success[100],   // #D1FAE3 – soft green
          warning[100],   // #FFF3C4 – soft amber
          alert[100],     // #FEE2E2 – soft red
          info[100],      // #C5F4FF – soft cyan
        ],
  },
  dark: {
    text: grey[100],
    background: grey[900],
    tint: primary[400],
    icon: grey[400],
    tabIconDefault: grey[500],
    tabIconSelected: primary[300],
    border: grey[700],
    card: grey[800],
    primary: primary[400],
    secondary: secondary[400],
    error: alert[500],
    success: success[500],
    warning: warning[500],
    info: info[400],
    notification: alert[500],
    disabledInputBackground: grey[700],
    disabledInputText: grey[500],
    cardHeader: grey[800],
    inputBackground: grey[700],
    warningBackground: warning[900],
    warningText: warning[200],
    bottomSheetHandle: grey[600],
    bottomSheetBackground: grey[800],
    shadow: 'rgba(0,32,64,0.48)',
    iconShadow: primary[400],

    labels: [
      primary[300],   // #7FC7FD
      secondary[300], // #72D2D9
      success[300],   // #6EE7A3
      warning[300],   // #FFD66E
      alert[300],     // #FCA5A5
      info[300],      // #66DEFE
    ],
  },
  // expose full ramps
  primary, secondary, grey, neutral, alert, success, warning, info,
};

/* ------------------------------------------------------------------------
   How to consume (Expo / RN)
   ------------------------------------------------------------------------

import { useColorScheme } from 'react-native';              // RN hook :contentReference[oaicite:2]{index=2}
import { Colors } from '@/theme/Colors';

export const useThemeColors = () => {
  const scheme = useColorScheme();              // 'light' | 'dark' | null
  return Colors[scheme ?? 'light'];
};

/*
 * If you need to force the scheme or allow auto-switching, set
 * "userInterfaceStyle": "automatic" | "light" | "dark"
 * in app.json / app.config.js (Expo). :contentReference[oaicite:3]{index=3}
 */
