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
 * Network-dependent, and skipped when no storefront is reachable, so an
 * offline `npm test` reports honestly. Set SITE_CONFIG_URL to point at a
 * deployed storefront.
 */
const BASE = process.env.SITE_CONFIG_URL ?? process.env.EXPO_PUBLIC_SITE_URL ?? 'http://localhost:4321';

export async function run(): Promise<void> {
    let payload: {config?: unknown; locale?: string};

    try {
        const response = await fetch(`${BASE}/api/site-config?locale=en`, {
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
            console.log(`        (skipped: site-config responded ${response.status})`);
            return;
        }
        payload = (await response.json()) as {config?: unknown; locale?: string};
    } catch {
        console.log('        (skipped: no storefront reachable)');
        return;
    }

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
