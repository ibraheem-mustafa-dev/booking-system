// Theme configuration and presets for the booking system
// Each organisation can fully customise their theme via the branding JSON column

export type FontFamily = 'Inter' | 'DM Sans' | 'Playfair Display' | 'Poppins' | 'Plus Jakarta Sans';
export type BorderRadius = 'none' | 'sm' | 'md' | 'lg' | 'full';
export type ButtonStyle = 'solid' | 'outline' | 'ghost' | 'gradient';

export interface ThemeConfig {
  primaryColour: string;
  accentColour: string;
  textColour: string;
  backgroundColour: string;
  fontFamily: FontFamily;
  borderRadius: BorderRadius;
  buttonStyle: ButtonStyle;
  logoUrl?: string;
  darkMode?: {
    primaryColour?: string;
    accentColour?: string;
    textColour?: string;
    backgroundColour?: string;
  };
}

export const BORDER_RADIUS_MAP: Record<BorderRadius, string> = {
  none: '0px',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  full: '9999px',
};

export const FONT_FAMILY_MAP: Record<FontFamily, string> = {
  'Inter': '"Inter", sans-serif',
  'DM Sans': '"DM Sans", sans-serif',
  'Playfair Display': '"Playfair Display", serif',
  'Poppins': '"Poppins", sans-serif',
  'Plus Jakarta Sans': '"Plus Jakarta Sans", sans-serif',
};

// Pre-built style presets for common niches
export const THEME_PRESETS: Record<string, ThemeConfig> = {
  'small-giants': {
    primaryColour: '#0F7E80',
    accentColour: '#F87A1F',
    textColour: '#1a1a1a',
    backgroundColour: '#ffffff',
    fontFamily: 'Inter',
    borderRadius: 'md',
    buttonStyle: 'solid',
    darkMode: {
      primaryColour: '#2a9d9d',
      accentColour: '#F87A1F',
      textColour: '#f0f0f0',
      backgroundColour: '#0f1419',
    },
  },
  corporate: {
    primaryColour: '#1e3a5f',
    accentColour: '#6b7280',
    textColour: '#111827',
    backgroundColour: '#ffffff',
    fontFamily: 'Inter',
    borderRadius: 'sm',
    buttonStyle: 'solid',
  },
  creative: {
    primaryColour: '#7c3aed',
    accentColour: '#f59e0b',
    textColour: '#1f2937',
    backgroundColour: '#ffffff',
    fontFamily: 'DM Sans',
    borderRadius: 'lg',
    buttonStyle: 'solid',
  },
  wellness: {
    primaryColour: '#059669',
    accentColour: '#92400e',
    textColour: '#1f2937',
    backgroundColour: '#fefce8',
    fontFamily: 'Poppins',
    borderRadius: 'full',
    buttonStyle: 'solid',
  },
  events: {
    primaryColour: '#dc2626',
    accentColour: '#2563eb',
    textColour: '#111827',
    backgroundColour: '#ffffff',
    fontFamily: 'Plus Jakarta Sans',
    borderRadius: 'md',
    buttonStyle: 'gradient',
  },
  luxury: {
    primaryColour: '#1a1a1a',
    accentColour: '#d4a574',
    textColour: '#1a1a1a',
    backgroundColour: '#faf8f5',
    fontFamily: 'Playfair Display',
    borderRadius: 'none',
    buttonStyle: 'outline',
    darkMode: {
      primaryColour: '#d4a574',
      textColour: '#faf8f5',
      backgroundColour: '#1a1a1a',
    },
  },
};

/**
 * Generates CSS custom properties from a theme config.
 * These are injected at runtime on the booking page's root element.
 */
export function generateCssVariables(theme: ThemeConfig): Record<string, string> {
  return {
    '--brand-primary': theme.primaryColour,
    '--brand-accent': theme.accentColour,
    '--brand-text': theme.textColour,
    '--brand-background': theme.backgroundColour,
    '--brand-font': FONT_FAMILY_MAP[theme.fontFamily],
    '--brand-radius': BORDER_RADIUS_MAP[theme.borderRadius],
  };
}
