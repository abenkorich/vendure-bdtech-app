/**
 * Normalize storefront hrefs so next-intl Link never receives absolute
 * localhost/production origins (which break client navigation / console).
 */
export function toStorefrontPath(href: string): string {
    const trimmed = href.trim();
    if (!trimmed || trimmed === '#') return '/';

    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
        return trimmed;
    }

    try {
        const url = new URL(trimmed);
        if (
            url.hostname === 'localhost' ||
            url.hostname === '127.0.0.1' ||
            (typeof window !== 'undefined' && url.hostname === window.location.hostname) ||
            (process.env.NEXT_PUBLIC_SITE_URL &&
                url.hostname === new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname)
        ) {
            return `${url.pathname}${url.search}${url.hash}` || '/';
        }
    } catch {
        // fall through
    }

    return trimmed;
}

export function isExternalHref(href: string): boolean {
    const path = toStorefrontPath(href);
    return /^https?:\/\//i.test(path);
}
