/**
 * VibeSHell — Dark-mode-first color palette
 *
 * Inspired by modern IDE aesthetics (GitHub Dark, VS Code).
 * Every token is a raw hex string so it can be consumed by
 * StyleSheet, Animated, or any third-party lib without wrapping.
 */

// ─── Background layers (darkest → lightest) ─────────────────────────
export const backgrounds = {
  /** App-level root background */
  primary: '#0D1117',
  /** Alias for primary — used by some components */
  base: '#0D1117',
  /** Cards, panels, sidebars */
  secondary: '#161B22',
  /** Elevated surfaces, modals */
  tertiary: '#21262D',
  /** Alias for tertiary — code blocks, elevated containers */
  elevated: '#21262D',
} as const;

// ─── Surface layers ──────────────────────────────────────────────────
export const surfaces = {
  /** Default surface (input fields, list items) */
  default: '#1C2128',
  /** Alias for default — used by some components */
  surface: '#1C2128',
  /** Hovered / active surface */
  hover: '#2D333B',
  /** Overlay / backdrop tint */
  overlay: 'rgba(13, 17, 23, 0.72)',
  /** Pressed state */
  pressed: '#373E47',
} as const;

// ─── Brand / accent ─────────────────────────────────────────────────
export const brand = {
  /** Primary interactive color (links, buttons, focused borders) */
  primary: '#00d4aa',
  /** Lighter variant for hover states */
  primaryHover: '#00e6bc',
  /** Muted variant for subtle highlights */
  primaryMuted: 'rgba(0, 212, 170, 0.12)',
  /** Accent / secondary brand color */
  accent: '#7aa2f7',
  /** Accent hover */
  accentHover: '#89b4fa',
  /** Accent muted */
  accentMuted: 'rgba(122, 162, 247, 0.12)',
} as const;

// ─── Text hierarchy ─────────────────────────────────────────────────
export const text = {
  /** Primary text — headings, body */
  primary: '#E6EDF3',
  /** Secondary text — descriptions, labels */
  secondary: '#8B949E',
  /** Muted text — placeholders, disabled */
  muted: '#8B949E',
  /** Tertiary / disabled text */
  tertiary: '#484F58',
  /** Inverse text (on light / primary backgrounds) */
  inverse: '#0D1117',
  /** Link text */
  link: '#00d4aa',
} as const;

// ─── Semantic ────────────────────────────────────────────────────────
export const semantic = {
  success: '#3FB950',
  successMuted: 'rgba(63, 185, 80, 0.15)',
  warning: '#D29922',
  warningMuted: 'rgba(210, 153, 34, 0.15)',
  error: '#F85149',
  errorMuted: 'rgba(248, 81, 73, 0.15)',
  info: '#00d4aa',
  infoMuted: 'rgba(0, 212, 170, 0.12)',
} as const;

// ─── Diff / code review ─────────────────────────────────────────────
export const diff = {
  addedBg: 'rgba(63, 185, 80, 0.12)',
  addedText: '#3FB950',
  addedBorder: 'rgba(63, 185, 80, 0.30)',
  removedBg: 'rgba(248, 81, 73, 0.12)',
  removedText: '#F85149',
  removedBorder: 'rgba(248, 81, 73, 0.30)',
  modifiedBg: 'rgba(210, 153, 34, 0.12)',
  modifiedText: '#D29922',
  modifiedBorder: 'rgba(210, 153, 34, 0.30)',
  hunkHeader: '#2D333B',
} as const;

// ─── Borders ─────────────────────────────────────────────────────────
export const borders = {
  default: '#30363D',
  muted: '#21262D',
  subtle: 'rgba(240, 246, 252, 0.06)',
  focused: '#00d4aa',
} as const;

// ─── Syntax highlighting (for code viewers) ──────────────────────────
export const syntax = {
  keyword: '#FF7B72',
  string: '#A5D6FF',
  comment: '#8B949E',
  function: '#D2A8FF',
  variable: '#FFA657',
  type: '#79C0FF',
  number: '#79C0FF',
  operator: '#FF7B72',
  punctuation: '#8B949E',
  constant: '#79C0FF',
} as const;

// ─── Aggregate export ────────────────────────────────────────────────
export const colors = {
  backgrounds,
  surfaces,
  brand,
  text,
  semantic,
  diff,
  borders,
  syntax,
} as const;

export type Colors = typeof colors;
