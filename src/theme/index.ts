/**
 * VibeSHell — Theme barrel export
 *
 * Usage:
 *   import { theme } from '@/theme';            // unified object
 *   import { colors, typography } from '@/theme'; // granular
 */

export {
  colors,
  backgrounds,
  surfaces,
  brand,
  text,
  semantic,
  diff,
  borders,
  syntax,
} from './colors';
export type { Colors } from './colors';

export {
  typography,
  fontFamilies,
  fontSizes,
  lineHeights,
  fontWeights,
  letterSpacing,
  textStyles,
} from './typography';
export type { Typography } from './typography';

export {
  spacingTokens,
  spacing,
  borderRadius,
  borderWidths,
  iconSizes,
  layout,
  shadows,
} from './spacing';
export type { SpacingTokens } from './spacing';

// ─── Unified theme object ────────────────────────────────────────────
import { colors } from './colors';
import { typography } from './typography';
import { spacingTokens } from './spacing';

export const theme = {
  colors,
  typography,
  ...spacingTokens,
} as const;

export type Theme = typeof theme;
