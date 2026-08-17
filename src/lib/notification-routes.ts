/**
 * Notification payload handling.
 *
 * Pure, so it can be unit-tested: `push.ts` imports expo-notifications and
 * expo-router and therefore cannot be bundled for the Node test harness.
 *
 * The rule this enforces: a notification's destination comes from the
 * *backend*, so it is untrusted input. `router.push` to a path that does not
 * exist does nothing at all — no crash, no log — so a typo in a campaign
 * payload would show up as "the notification opens the app but nothing
 * happens", which is indistinguishable from the app being broken.
 */

/**
 * Route patterns the app actually serves, mirroring `src/app/**`.
 *
 * Duplicated deliberately rather than derived: this list is what a *push
 * payload* is allowed to target, which is a narrower question than what the
 * router can render. `tests/routes.test.ts` walks the real file tree and
 * asserts these all still exist, so the two cannot drift apart silently.
 */
export const NOTIFICATION_ROUTES = [
    '/',
    '/shop',
    '/search',
    '/cart',
    '/account',
    '/account/orders',
    '/account/orders/:code',
    '/account/addresses',
    '/product/:slug',
    '/collection/:slug',
    '/order/:code',
    '/blog',
    '/blog/:slug',
    '/tools',
    '/tools/:slug',
    '/wishlist',
    '/compare',
    '/checkout',
] as const;

function toPattern(route: string): RegExp {
    const source = route
        .split('/')
        .map(segment =>
            segment.startsWith(':')
                ? '[^/]+'
                : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        )
        .join('/');
    return new RegExp(`^${source}$`);
}

const PATTERNS = NOTIFICATION_ROUTES.map(toPattern);

/**
 * Extract a safe in-app path from a notification payload.
 *
 * Returns null when there is nothing to open, which callers treat as "just
 * bring the app to the foreground".
 *
 * Rejects, in order of how likely each is to actually happen:
 *  - a missing or non-string `url`
 *  - an absolute URL (`https://…`, `dzduino://…`), since routing one through
 *    `router.push` would either no-op or, worse, be a way for a spoofed
 *    payload to point the app somewhere unexpected
 *  - protocol-relative (`//host`) and traversal (`..`) forms
 *  - any path that does not match a route the app serves
 */
export function resolveNotificationUrl(data: unknown): string | null {
    if (data === null || typeof data !== 'object') return null;

    const url = (data as {url?: unknown}).url;
    if (typeof url !== 'string') return null;

    const trimmed = url.trim();
    if (!trimmed.startsWith('/')) return null;
    if (trimmed.startsWith('//')) return null;
    if (trimmed.includes('..')) return null;

    // Query and fragment are allowed through to the router, but the *route*
    // match is on the path alone.
    const path = trimmed.split(/[?#]/)[0] ?? '';
    const normalised = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;

    return PATTERNS.some(pattern => pattern.test(normalised)) ? trimmed : null;
}
