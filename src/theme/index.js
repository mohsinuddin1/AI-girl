// PureScan AI Design System — ported from webtoxic/src/index.css

// Force light theme regardless of device settings
const isDark = false;

export const Colors = {
  // Core Theming
  background: '#FCFBF8', // Cream/Off-white
  surface: isDark ? '#1e293b' : '#FCFBF8',
  surfaceElevated: isDark ? '#334155' : '#ffffff',
  surfaceMuted: isDark ? '#1e293b' : '#F2F1EC', // Slightly darker cream for cards

  border: isDark ? '#334155' : '#E5E4E0',
  borderLight: isDark ? '#1e293b' : '#F2F1EC',

  primary: isDark ? '#f8fafc' : '#1F614C', // Forest Green for Headings
  secondary: isDark ? '#94a3b8' : '#5E6D64', // Muted forest green/grey

  accent: '#1F614C', // Forest Green
  accentLight: isDark ? 'rgba(31, 97, 76, 0.15)' : '#E2E8E4', // Light green bg
  danger: '#D9534F',
  success: '#1F614C',
  warning: '#F0AD4E',

  // Grade Colors
  gradeA: '#10b981',
  gradeB: '#84cc16',
  gradeC: '#eab308',
  gradeD: '#f97316',
  gradeE: '#ef4444',

  // Toxicity Gradient
  toxSafe: '#10b981',
  toxLow: '#84cc16',
  toxModerate: '#eab308',
  toxHigh: '#f97316',
  toxDanger: '#ef4444',

  // Text Aliases
  textPrimary: isDark ? '#f8fafc' : '#11181C', // Very dark grey for readability
  textSecondary: isDark ? '#94a3b8' : '#5E6D64',
  textMuted: isDark ? '#475569' : '#8A968F',

  // Fixed Absolutes
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

export const Fonts = {
  // Using native system fonts (San Francisco on iOS, Roboto on Android)
  // for that clean, premium look without the overhead of custom web fonts.
  sans: undefined, 
  display: undefined,
  mono: undefined,
};

export const FontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  base: 15,
  lg: 16,
  xl: 18,
  '2xl': 22,
  '3xl': 28,
  '4xl': 34,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
};

export const Radii = {
  sm: 8,
  md: 12,
  card: 20,
  button: 14,
  xl: 24,
  '2xl': 32,
  input: 12,
  pill: 9999,
};

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  fab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
};

export function getGradeColor(grade) {
  const colors = {
    A: Colors.gradeA,
    B: Colors.gradeB,
    C: Colors.gradeC,
    D: Colors.gradeD,
    E: Colors.gradeE,
  };
  return colors[grade] || colors.C;
}

export function getGradeBg(grade) {
  const map = {
    A: { bg: 'rgba(34,197,94,0.15)', text: Colors.gradeA },
    B: { bg: 'rgba(132,204,22,0.15)', text: Colors.gradeB },
    C: { bg: 'rgba(234,179,8,0.15)', text: Colors.gradeC },
    D: { bg: 'rgba(249,115,22,0.15)', text: Colors.gradeD },
    E: { bg: 'rgba(239,68,68,0.15)', text: Colors.gradeE },
  };
  return map[grade] || map.C;
}
