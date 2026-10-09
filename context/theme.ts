// Centralized Design Tokens for Student Mobile Experience
// Anchor Brand: Deep Violet (#7C3AED) matching Daily Quiz
// Accessibility: WCAG 2.1 AAA high-contrast standards for Deaf and Hard-of-Hearing (DHH) learners

export const COLORS = {
  // Brand Primary (Deep Violet & Indigo)
  primary: '#7C3AED',
  primaryDark: '#6D28D9',
  primaryLight: '#EDE9FE',
  primaryBorder: '#DDD6FE',

  // Surfaces & Canvas (Anti-glare for visual comfort)
  background: '#F8FAFC', // Slate-50 soothing canvas
  card: '#FFFFFF',
  cardSecondary: '#F1F5F9',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  // High-Contrast Typography
  textPrimary: '#0F172A',   // Slate-900 (High contrast body & headers)
  textSecondary: '#64748B', // Slate-500 (Subtitles & secondary labels)
  textMuted: '#94A3B8',     // Slate-400 (Inactive tab items)
  textInverse: '#FFFFFF',

  // Gamification Tokens
  star: '#F59E0B',        // Gold Star count & rewards
  starBg: '#FEF3C7',      // Soft amber container
  starBorder: '#FDE68A',
  streak: '#EA580C',      // Flame orange streak
  streakBg: '#FFEDD5',    // Soft orange container
  streakBorder: '#FED7AA',

  // Status & Feedback Tokens (Color + Icon Always)
  success: '#10B981',
  successBg: '#ECFDF5',
  successBorder: '#A7F3D0',
  error: '#EF4444',
  errorBg: '#FEF2F2',
  errorBorder: '#FECACA',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  warningBorder: '#FDE68A',

  // Difficulty Tiers (Consistent across Daily Quiz, Topics, and Quizzes)
  easy: '#10B981',
  easyBg: '#ECFDF5',
  easyBorder: '#6EE7B7',
  medium: '#F59E0B',
  mediumBg: '#FFFBEB',
  mediumBorder: '#FCD34D',
  hard: '#EF4444',
  hardBg: '#FEF2F2',
  hardBorder: '#FCA5A5',

  // Subject Accents
  storyGrammar: '#7C3AED',
  storyGrammarBg: '#EDE9FE',
  mathematics: '#2563EB',
  mathematicsBg: '#EFF6FF',
  tle: '#D97706',
  tleBg: '#FFFBEB',
  aralingPanlipunan: '#059669',
  aralingPanlipunanBg: '#ECFDF5',

  // Tools & Quick Tiles
  aslTeal: '#0D9488',
  aslTealBg: '#CCFBF1',
  flashcardsViolet: '#7C3AED',
  flashcardsVioletBg: '#F5F3FF',
  skillTreeBlue: '#2563EB',
  skillTreeBlueBg: '#EFF6FF',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const SHADOWS = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHover: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

// Story Grammar Elements for Visual Scaffolding
export const STORY_GRAMMAR_ELEMENTS: Record<number, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}> = {
  0: {
    label: 'Character & Setting',
    icon: 'person-outline',
    color: COLORS.storyGrammar,
    bgColor: COLORS.storyGrammarBg,
  },
  1: {
    label: 'Problem & Challenge',
    icon: 'alert-circle-outline',
    color: COLORS.warning,
    bgColor: COLORS.warningBg,
  },
  2: {
    label: 'Action & Rules',
    icon: 'build-outline',
    color: COLORS.mathematics,
    bgColor: COLORS.mathematicsBg,
  },
  3: {
    label: 'Resolution & Outcome',
    icon: 'checkmark-circle-outline',
    color: COLORS.success,
    bgColor: COLORS.successBg,
  },
};
