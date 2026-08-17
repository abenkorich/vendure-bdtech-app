import {readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {NOTIFICATION_ROUTES} from '@/lib/notification-routes';
import {check, done} from './harness';

/**
 * Every path the app links to must correspond to a real route file.
 *
 * `router.push('/tools')` with no `app/tools/` route does nothing visible: no
 * crash, no log, just a tap that appears ignored. That is exactly how the
 * account screen shipped with four dead links. Typed routes catch this for
 * literals, but not for a path built at runtime or delivered in a push payload.
 *
 * This walks `src/app` for real routes and asserts the app's known entry
 * points resolve.
 */

const APP_DIR = join(process.cwd(), 'src', 'app');

/** Route paths derived from the expo-router file tree. */
function collectRoutes(dir: string, prefix = ''): string[] {
    const routes: string[] = [];

    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);

        if (statSync(full).isDirectory()) {
            // `(group)` segments are organisational and do not appear in URLs.
            const segment = entry.startsWith('(') && entry.endsWith(')') ? '' : `/${entry}`;
            routes.push(...collectRoutes(full, prefix + segment));
            continue;
        }

        if (!entry.endsWith('.tsx')) continue;
        // `_layout` and `_showcase` are not navigable destinations.
        if (entry.startsWith('_')) continue;

        const name = entry.replace(/\.tsx$/, '');
        routes.push(name === 'index' ? prefix || '/' : `${prefix}/${name}`);
    }

    return routes;
}

/** Turn `/product/[slug]` into a matcher for `/product/anything`. */
function toPattern(route: string): RegExp {
    const source = route
        .split('/')
        .map(segment =>
            segment.startsWith('[') && segment.endsWith(']') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        )
        .join('/');
    return new RegExp(`^${source}$`);
}

/**
 * Destinations the UI links to. Extend this when a screen starts linking
 * somewhere new; that is cheaper than discovering a dead link on a device.
 */
const LINKED_PATHS = [
    '/',
    '/shop',
    '/search',
    '/cart',
    '/account',
    '/product/some-slug',
    '/collection/some-slug',
    '/auth/sign-in',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/account/orders',
    '/account/orders/ABC123',
    '/account/addresses',
    '/wishlist',
    '/compare',
    '/notifications',
    '/messages',
    '/tools',
    '/tools/ohms-law',
    '/blog',
    '/blog/some-post',
    '/checkout',
    '/order/ABC123',
];

export async function run(): Promise<void> {
    const routes = collectRoutes(APP_DIR);
    const patterns = routes.map(toPattern);

    check('routes were discovered', routes.length > 5, `found ${routes.length}`);

    const dead = LINKED_PATHS.filter(path => !patterns.some(pattern => pattern.test(path)));

    check(
        'every linked path resolves to a route',
        dead.length === 0,
        `dead links: ${dead.join(', ')}\n      routes: ${routes.sort().join(', ')}`,
    );

    // The push allow-list is maintained by hand (a payload may target a
    // narrower set than the router can render), so it can drift away from the
    // real tree. A notification pointing at a deleted route would open the app
    // and then silently do nothing.
    const orphaned = NOTIFICATION_ROUTES.filter(route => {
        const concrete = route.replace(/:[a-z]+/gi, 'sample');
        return !patterns.some(pattern => pattern.test(concrete));
    });

    check(
        'every push-notification route still exists in the app',
        orphaned.length === 0,
        `no longer routable: ${orphaned.join(', ')}`,
    );

    done();
}
