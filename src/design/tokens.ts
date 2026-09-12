/**
 * Design tokens — "Precision Instrument".
 *
 * Colors are converted from the web storefront's oklch values (see
 * `src/styles/globals.css` there) rather than eyeballed, so the app is
 * demonstrably the same brand. React Native cannot parse `oklch()`, hence hex.
 *
 * Brand accent is indigo, oklch hue 264 — the storefront's default accent.
 *
 * The rule that governs use: **the accent is a signal, not decoration**. It
 * marks interactive and stateful things (price, stock, CTAs, focus) and is
 * never used as a large decorative fill.
 */

/* -------------------------------------------------------------------------- */
/* Palette                                                                    */
/* -------------------------------------------------------------------------- */

const palette = {
    brand: '#2961f2',
    brandDark: '#5e92ff',
    brandMutedLight: '#e4efff',
    brandMutedDark: '#192846',

    sale: '#e11c4a',
    saleDark: '#ff2056',
    /**
     * Back-in-stock alerts. Orange-700 rather than a brighter orange because
     * white has to be legible on it: orange-500 on white is 2.89:1 and this
     * carries a label, not just a glyph. The storefront's notify button uses
     * the same value for the same reason.
     */
    notify: '#c2410c',
    notifyDark: '#ff8904',
    success: '#2c974f',
    successDark: '#00bc7d',
    danger: '#e7000b',
    dangerDark: '#ff6467',

    white: '#ffffff',
    slate950: '#020618',
    slate900: '#0f172b',
    slate800: '#1d293d',
    slate400: '#90a1b9',
    slate500: '#62748e',
    slate200: '#e2e8f0',
    slate100: '#f1f5f9',
} as const;

/* -------------------------------------------------------------------------- */
/* Themes                                                                     */
/* -------------------------------------------------------------------------- */

export interface AppColors {
    /** Screen background. */
    background: string;
    /** Raised surface: cards, sheets, headers. */
    surface: string;
    /** Surface one step further up: pressed cards, nested rows. */
    surfaceElevated: string;
    /** Primary text. */
    text: string;
    /** Secondary text: metadata, captions, disabled. */
    textMuted: string;
    /** Hairlines and dividers. */
    border: string;

    brand: string;
    /** Text/icon color that sits legibly on `brand`. */
    onBrand: string;
    /** Low-emphasis brand wash: selected chips, badges. */
    brandMuted: string;

    sale: string;
    /** Back-in-stock alerts: neither a purchase nor an error. */
    notify: string;
    /** Text/icon color that sits legibly on `notify`. */
    onNotify: string;
    success: string;
    danger: string;

    /** Skeleton base while loading. */
    skeleton: string;
}

const lightColors: AppColors = {
    background: palette.white,
    surface: palette.white,
    surfaceElevated: palette.slate100,
    text: palette.slate950,
    textMuted: palette.slate500,
    border: palette.slate200,
    brand: palette.brand,
    onBrand: palette.white,
    brandMuted: palette.brandMutedLight,
    sale: palette.sale,
    notify: palette.notify,
    onNotify: palette.white,
    success: palette.success,
    danger: palette.danger,
    skeleton: palette.slate100,
};

const darkColors: AppColors = {
    background: palette.slate950,
    surface: palette.slate900,
    surfaceElevated: palette.slate800,
    text: '#f8fafc',
    textMuted: palette.slate400,
    border: 'rgba(255,255,255,0.10)',
    brand: palette.brandDark,
    onBrand: palette.slate950,
    brandMuted: palette.brandMutedDark,
    sale: palette.saleDark,
    // Inverted the way `brand`/`onBrand` are: a bright orange on a near-black
    // ground carries a dark glyph, not a white one.
    notify: palette.notifyDark,
    onNotify: palette.slate950,
    success: palette.successDark,
    danger: palette.dangerDark,
    skeleton: palette.slate800,
};

/* -------------------------------------------------------------------------- */
/* Scales                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * 4pt spacing grid. Use the scale, not raw numbers: an arbitrary `padding: 13`
 * is what makes a screen look drifted next to the rest of the app.
 */
export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
} as const;

/** Derived from the storefront's `--radius: 0.625rem` (10pt) baseline. */
export const radius = {
    none: 0,
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 999,
} as const;

/**
 * Type scale. `tabular` marks the styles used for prices, SKUs and spec values;
 * those must render with `fontVariant: ['tabular-nums']` so digits align in
 * columns and a price does not jitter as it updates.
 */
export const typography = {
    display: {fontSize: 32, lineHeight: 38, fontWeight: '700'},
    title: {fontSize: 24, lineHeight: 30, fontWeight: '700'},
    heading: {fontSize: 19, lineHeight: 25, fontWeight: '600'},
    body: {fontSize: 15, lineHeight: 22, fontWeight: '400'},
    bodyStrong: {fontSize: 15, lineHeight: 22, fontWeight: '600'},
    caption: {fontSize: 13, lineHeight: 18, fontWeight: '400'},
    micro: {fontSize: 11, lineHeight: 15, fontWeight: '600'},
} as const;

/**
 * Motion. Nothing exceeds 300ms: this is a shopping app, and a slow transition
 * reads as lag rather than polish.
 */
export const motion = {
    fast: 140,
    base: 220,
    slow: 300,
    /** Spring for sheets and shared-element transitions. */
    spring: {damping: 22, stiffness: 240, mass: 0.8},
} as const;

/**
 * Elevation via tint, not shadow. Shadows render inconsistently across
 * platforms and look muddy on dark surfaces, which is where this app lives.
 * A border plus a lighter surface reads as "raised" in both schemes.
 */
export const elevation = {
    card: {borderWidth: 1},
    sheet: {borderWidth: 1, borderBottomWidth: 0},
} as const;

/** Minimum touch target. Below 44pt fails Apple's HIG and is hard to hit. */
export const HIT_SLOP_MIN = 44;

export const lightTheme = {
    colors: lightColors,
    spacing,
    radius,
    typography,
    motion,
    elevation,
    isDark: false,
} as const;

export const darkTheme = {
    ...lightTheme,
    colors: darkColors,
    isDark: true,
} as const;

export type AppTheme = typeof lightTheme;
