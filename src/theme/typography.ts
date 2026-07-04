/**
 * VibeSHell — Typography system
 *
 * Uses platform-native system fonts for UI and monospace stacks
 * for code / terminal output via Platform.select.
 */

import { Platform, TextStyle } from 'react-native';

// ─── Font families ───────────────────────────────────────────────────
export const fontFamilies = {
  /** System sans-serif — used for all UI text */
  sans: Platform.select({
    ios: 'SF Pro Text',
    android: 'Roboto',
    default: 'system-ui, -apple-system, sans-serif',
  }) as string,

  /** Display / heading variant */
  display: Platform.select({
    ios: 'SF Pro Display',
    android: 'Roboto',
    default: 'system-ui, -apple-system, sans-serif',
  }) as string,

  /** Monospace — terminal & code blocks */
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  }) as string,
} as const;

// ─── Font sizes ──────────────────────────────────────────────────────
export const fontSizes = {
  /** 11px — captions, badges */
  xs: 11,
  /** 12px — helper text, timestamps */
  sm: 12,
  /** 14px — body / default */
  md: 14,
  /** 16px — subtitles, emphasis */
  lg: 16,
  /** 20px — section headings */
  xl: 20,
  /** 24px — page titles */
  xxl: 24,
  /** 32px — hero / splash */
  xxxl: 32,
} as const;

// ─── Line heights (multipliers of their font size) ──────────────────
export const lineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,
} as const;

// ─── Font weights ────────────────────────────────────────────────────
export const fontWeights = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
};

// ─── Letter spacing ──────────────────────────────────────────────────
export const letterSpacing = {
  tight: -0.3,
  normal: 0,
  wide: 0.5,
  wider: 1.0,
} as const;

// ─── Pre-composed text styles ────────────────────────────────────────
export const textStyles = {
  /** Hero / splash headline */
  hero: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.xxxl,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.xxxl * lineHeights.tight,
    letterSpacing: letterSpacing.tight,
  } as TextStyle,

  /** Page title */
  title: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.xxl * lineHeights.tight,
    letterSpacing: letterSpacing.tight,
  } as TextStyle,

  /** Section heading */
  heading: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.xl * lineHeights.tight,
    letterSpacing: letterSpacing.normal,
  } as TextStyle,

  /** Subtitle / emphasized body */
  subtitle: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.lg * lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  } as TextStyle,

  /** Default body text */
  body: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.md * lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  } as TextStyle,

  /** Bold body variant */
  bodyBold: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.md * lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  } as TextStyle,

  /** Small text — descriptions, timestamps */
  small: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.sm * lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  } as TextStyle,

  /** Extra-small — captions, badges */
  caption: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.xs * lineHeights.normal,
    letterSpacing: letterSpacing.wide,
  } as TextStyle,

  /** Monospace — inline code */
  code: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.md * lineHeights.relaxed,
    letterSpacing: letterSpacing.normal,
  } as TextStyle,

  /** Monospace small — terminal output */
  codeSmall: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.sm * lineHeights.relaxed,
    letterSpacing: letterSpacing.normal,
  } as TextStyle,

  /** Button label */
  button: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.md * lineHeights.tight,
    letterSpacing: letterSpacing.wide,
  } as TextStyle,

  /** Tab / navigation label */
  label: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.sm * lineHeights.tight,
    letterSpacing: letterSpacing.normal,
  } as TextStyle,

  /** Small body variant — secondary text in cards, buttons */
  bodySmall: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.sm * lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  } as TextStyle,
} as const;

// ─── Aggregate export ────────────────────────────────────────────────
export const typography = {
  fontFamilies,
  fontSizes,
  lineHeights,
  fontWeights,
  letterSpacing,
  textStyles,
} as const;

export type Typography = typeof typography;
