import {parseSiteConfigVerbose, enabledSlides} from '@/lib/site-config/schema';
import {check, done} from './harness';

/**
 * The live endpoint's payload must satisfy the app's schema.
 *
 * `parseSiteConfig` never throws — it degrades to defaults — which is right for
 * the app and dangerous for a test: a schema drift would show up as a home
 * screen quietly losing its hero and categories, with nothing failing. This
 * asserts the payload parses *cleanly*, not merely without crashing.
 *
 * Skipped only when the host is unreachable (offline, or no storefront
 * running), so an offline `npm test` still reports honestly. A *reachable*
 * host answering 5xx is a deployed endpoint that is broken, which is a
 * failure: treating it as a skip is how this quietly reported PASS while
 * production answered 500 to every locale. Set SITE_CONFIG_URL to point at a
 * deployed storefront.
 */
const BASE = process.env.SITE_CONFIG_URL ?? process.env.EXPO_PUBLIC_SITE_URL ?? 'http://localhost:4321';

export async function run(): Promise<void> {
    let status = 0;
    let body: string | null = null;

    // Fetch inside the try, assert outside it. `check` throws on failure, so
    // asserting in here would be caught by the same catch that means "no
    // storefront" — which is precisely how a live 500 got reported as a skip
    // and then as a PASS.
    try {
        const response = await fetch(`${BASE}/api/site-config?locale=en`, {
            signal: AbortSignal.timeout(8000),
        });
        status = response.status;
        // A storefront that serves its SPA shell for unknown paths answers 200
        // with HTML, so status alone does not mean "this is the config".
        const isJson = (response.headers.get('content-type') ?? '').includes('json');
        if (response.ok && isJson) body = await response.text();
    } catch {
        console.log('        (skipped: no storefront reachable)');
        return;
    }

    if (status >= 500) {
        check(
            `site-config is deployed but failing: ${BASE} answered ${status}`,
            false,
            'the endpoint exists and is erroring, so the app falls back to its ' +
                'bundled snapshot and the merchant’s edits never reach the phone.',
        );
        done();
        return;
    }

    if (body === null) {
        // 404, or HTML from a catch-all route: "not deployed yet", which is a
        // state of the world rather than a defect in this repo.
        console.log(`        (skipped: site-config responded ${status} without json)`);
        return;
    }

    const payload = JSON.parse(body) as {config?: unknown; locale?: string};

    const {config, ok, issues} = parseSiteConfigVerbose(payload.config);

    check('the published config satisfies the app schema', ok, issues.join('\n      '));

    // Parsing cleanly is not enough: a schema that silently defaulted every
    // section would also "parse". These assert the payload carries the content
    // the home screen is built around.
    check(
        'the config carries hero slides',
        enabledSlides(config.hero).length > 0,
        `${config.hero.slides.length} slides, ${enabledSlides(config.hero).length} enabled`,
    );
    check(
        'the config carries highlighted categories',
        config.popularCategories.collectionSlugs.length > 0,
        `${config.popularCategories.collectionSlugs.length} slugs`,
    );
    check(
        'hero slides carry copy for every shipped locale',
        enabledSlides(config.hero).every(slide =>
            ['en', 'fr', 'ar'].every(locale => slide.copy?.[locale] !== undefined),
        ),
        'a slide is missing copy for en, fr or ar',
    );
    check(
        'the config carries a contact route for the messages screen',
        config.storeInfo.emails.length + config.storeInfo.phones.length > 0,
        'no emails or phones',
    );

    done();
}
