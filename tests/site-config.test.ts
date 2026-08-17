import {
    parseSiteConfig,
    enabledSlides,
    slideCopy,
} from '@/lib/site-config/schema';
import fallback from '@/lib/site-config/fallback.json';
import {check, eq, done} from './harness';

/**
 * Site config arrives over the network, edited by a merchant in a different
 * application. It is the least trustworthy input the app has, and it drives
 * the first screen anyone sees, so parsing must be total: any shape at all
 * yields a renderable config rather than a crash.
 */
export async function run(): Promise<void> {
    /* ------------------------------------------------------- hostile input */

    for (const [name, input] of [
        ['undefined', undefined],
        ['null', null],
        ['a string', 'nope'],
        ['a number', 42],
        ['an array', [1, 2, 3]],
        ['an empty object', {}],
        ['wrong-typed sections', {hero: 'no', popularCategories: 5, search: [], header: null}],
        ['a slide missing its id', {hero: {slides: [{enabled: true}]}}],
        ['an out-of-range opacity', {hero: {slides: [{id: 'a', overlayOpacity: 99}]}}],
    ] as const) {
        const config = parseSiteConfig(input);
        check(
            `${name} still yields a renderable config`,
            Array.isArray(config.hero.slides) &&
                Array.isArray(config.popularCategories.collectionSlugs) &&
                typeof config.hero.intervalMs === 'number',
            JSON.stringify(config).slice(0, 120),
        );
    }

    /* ------------------------------------------------- the bundled snapshot */

    const bundled = parseSiteConfig(fallback);
    check(
        'the bundled fallback carries real slides',
        bundled.hero.slides.length > 0,
        `${bundled.hero.slides.length} slides`,
    );
    check(
        'the bundled fallback carries categories',
        bundled.popularCategories.collectionSlugs.length > 0,
        `${bundled.popularCategories.collectionSlugs.length} slugs`,
    );

    /* -------------------------------------------------------------- helpers */

    const config = parseSiteConfig({
        hero: {
            slides: [
                {id: 'on', enabled: true},
                {id: 'off', enabled: false},
                {id: 'also-on', enabled: true},
            ],
        },
    });
    eq('disabled slides are filtered out', enabledSlides(config.hero).length, 2);

    const slide = parseSiteConfig({
        hero: {slides: [{id: 's', copy: {en: {title: 'Hello'}, fr: {title: 'Bonjour'}}}]},
    }).hero.slides[0]!;

    eq('copy resolves for the active locale', slideCopy(slide, 'fr').title, 'Bonjour');
    eq('copy falls back to English', slideCopy(slide, 'ar').title, 'Hello');
    eq(
        'a slide with no copy yields an empty object, not a crash',
        Object.keys(slideCopy(parseSiteConfig({hero: {slides: [{id: 'x'}]}}).hero.slides[0]!, 'en')).length,
        0,
    );

    done();
}
