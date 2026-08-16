/** True for same-origin public paths (e.g. `/customizer/banners/…`). */
export function isLocalPublicPath(src: string): boolean {
    return src.startsWith('/');
}

/**
 * Prefer Next.js image optimization for almost everything.
 * Skip only formats the optimizer does not handle well (animated GIF).
 */
export function shouldSkipImageOptimization(src: string): boolean {
    return src.toLowerCase().endsWith('.gif');
}
