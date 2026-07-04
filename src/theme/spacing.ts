/**
 * VibeSHell — Spacing & dimension tokens
 *
 * Built on a 4 px base grid for pixel-perfect alignment.
 */

// ─── Spacing scale (4 px base) ──────────────────────────────────────
export const spacing = {
  /** 2px — hairline gaps */
  xxs: 2,
  /** 4px — tight inner padding */
  xs: 4,
  /** 8px — default inner padding */
  sm: 8,
  /** 12px — comfortable padding */
  md: 12,
  /** 16px — section gaps */
  lg: 16,
  /** 20px — card-level padding */
  xl: 20,
  /** 24px — large gaps */
  xxl: 24,
  /** 32px — section / screen margins */
  xxxl: 32,
  /** 48px — hero-level spacing */
  huge: 48,
  /** 64px — extra-large spacing */
  massive: 64,
} as const;

// ─── Border radius ───────────────────────────────────────────────────
export const borderRadius = {
  /** 0px — sharp edges */
  none: 0,
  /** 4px — subtle rounding (badges, chips) */
  xs: 4,
  /** 6px — inputs, buttons */
  sm: 6,
  /** 8px — cards, panels */
  md: 8,
  /** 12px — modals, floating elements, max for cards */
  lg: 12,
  /** 999px — circles (avatars) */
  full: 999,
} as const;

// ─── Border widths ───────────────────────────────────────────────────
export const borderWidths = {
  /** Hairline (StyleSheet.hairlineWidth equivalent) */
  hairline: 0.5,
  /** Default */
  thin: 1,
  /** Emphasis */
  medium: 2,
  /** Heavy emphasis */
  thick: 3,
} as const;

// ─── Icon sizes ──────────────────────────────────────────────────────
export const iconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ─── Common layout dimensions ────────────────────────────────────────
export const layout = {
  /** Status-bar-aware top inset (override with SafeAreaView) */
  statusBarHeight: 44,
  /** Tab bar height */
  tabBarHeight: 56,
  /** Header / navigation bar height */
  headerHeight: 56,
  /** Bottom sheet handle height */
  sheetHandleHeight: 24,
  /** Max content width for readable line length */
  maxContentWidth: 720,
  /** Input height */
  inputHeight: 44,
  /** Button heights */
  buttonHeightSm: 32,
  buttonHeightMd: 40,
  buttonHeightLg: 48,
  /** Avatar sizes */
  avatarSm: 24,
  avatarMd: 32,
  avatarLg: 48,
  avatarXl: 64,
} as const;

// ─── Shadows (dark-mode optimised) ───────────────────────────────────
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

// ─── Aggregate export ────────────────────────────────────────────────
export const spacingTokens = {
  spacing,
  borderRadius,
  borderWidths,
  iconSizes,
  layout,
  shadows,
} as const;

export type SpacingTokens = typeof spacingTokens;
