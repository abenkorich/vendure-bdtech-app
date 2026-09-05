import {readdirSync, readFileSync, statSync} from 'node:fs';
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
 * This walks `src/app` for real routes, then scans every source file for the
 * paths the UI actually pushes and asserts each resolves. The scan replaced a
 * hand-kept list: that list was how `/account/profile` and
 * `/account/password` shipped as dead links from the account tab, because
 * nobody added them to it.
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
 * Paths the source pushes: string and template literals handed to
 * `router.push/replace/navigate` or an `href`. A `${…}` segment stands for a
 * dynamic value. Group segments like `(tabs)` are organisational and stripped,
 * as expo-router does.
 */
const SRC_DIR = join(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap(entry => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return sourceFiles(full);
        return /\.(tsx?|ts)$/.test(entry) ? [full] : [];
    });
}

const LINK_PATTERN =
    /(?:router\.(?:push|replace|navigate)\(|\bhref[=:]\s*)\s*(?:['"`])((?:\/)[^'"`\s)]*)['"`]/g;

function normalizePath(raw: string): string {
    return (
        raw
            .replace(/\$\{[^}]*\}/g, 'sample')
            .replace(/\/\([^/]+\)/g, '')
            .split('?')[0] || '/'
    );
}

/** Every literal path the source links to, with the file it came from. */
function collectLinkedPaths(): Array<{path: string; file: string}> {
    const links: Array<{path: string; file: string}> = [];
    for (const file of sourceFiles(SRC_DIR)) {
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(LINK_PATTERN)) {
            links.push({path: normalizePath(match[1] ?? ''), file: file.replace(process.cwd(), '')});
        }
    }
    return links;
}

/**
 * Destinations reached by means the scan cannot see (a backend-supplied URL,
 * a computed segment), kept small on purpose: the scan is the real guard.
 */
const EXTRA_LINKED_PATHS = ['/', '/product/some-slug', '/collection/some-slug', '/order/ABC123'];

export async function run(): Promise<void> {
    const routes = collectRoutes(APP_DIR);
    const patterns = routes.map(toPattern);

    check('routes were discovered', routes.length > 5, `found ${routes.length}`);

    const linked = collectLinkedPaths();
    check('the source scan found links', linked.length > 20, `found ${linked.length}`);

    const dead = [
        ...linked,
        ...EXTRA_LINKED_PATHS.map(path => ({path, file: 'routes.test.ts'})),
    ].filter(({path}) => !patterns.some(pattern => pattern.test(path)));

    check(
        'every linked path resolves to a route',
        dead.length === 0,
        `dead links: ${dead.map(({path, file}) => `${path} (${file})`).join(', ')}\n      routes: ${routes.sort().join(', ')}`,
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
