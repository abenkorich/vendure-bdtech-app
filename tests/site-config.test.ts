import {
    parseSiteConfig,
    enabledSlides,
    slideCopy,
    absoluteAsset,
    contactLabel,
} from '@/lib/site-config/schema';
import fallback from '@/lib/site-config/fallback.json';
import {resolveAppUrl} from '@/lib/notification-routes';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
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

    // The snapshot names images by web path, and the deployed storefront
    // answers any path it lacks with a generic placeholder and a 200, so the
    // app ships its own copy of every image the snapshot uses. A snapshot
    // update that forgets the file, or the `require` table, would put the
    // placeholder back on the first screen with nothing failing.
    const snapshotImages = [
        bundled.header.logoUrl,
        ...enabledSlides(bundled.hero).map(slide => slide.imageUrl),
    ].filter((path): path is string => Boolean(path));
    const shipped = new Set(readdirSync(join(process.cwd(), 'assets', 'customizer')));
    const requireTable = readFileSync(
        join(process.cwd(), 'src', 'lib', 'site-config', 'bundled-assets.ts'),
        'utf8',
    );
    const notShipped = snapshotImages.filter(
        path => !shipped.has(path.split('/').pop() ?? '') || !requireTable.includes(`'${path}'`),
    );
    check(
        'every image the bundled snapshot names ships with the app',
        snapshotImages.length > 0 && notShipped.length === 0,
        `missing from assets/customizer or bundled-assets.ts: ${notShipped.join(', ')}`,
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

    /* ------------------------------------------------- asset resolution */

    // Every image out of site config is a web-root-relative path. Missing this
    // renders a blank box with no error, which is why it has its own test.
    eq(
        'a relative customizer path becomes absolute',
        absoluteAsset('/customizer/banners/x.jpg', 'https://dzduino.dz'),
        'https://dzduino.dz/customizer/banners/x.jpg',
    );
    eq(
        'a trailing slash on the origin does not double up',
        absoluteAsset('/banners/x.jpg', 'https://dzduino.dz/'),
        'https://dzduino.dz/banners/x.jpg',
    );
    eq(
        'a path without a leading slash still joins correctly',
        absoluteAsset('banners/x.jpg', 'https://dzduino.dz'),
        'https://dzduino.dz/banners/x.jpg',
    );
    eq(
        'an absolute url is left alone',
        absoluteAsset('https://cdn.example/x.jpg', 'https://dzduino.dz'),
        'https://cdn.example/x.jpg',
    );
    eq('an absent url stays undefined', absoluteAsset(undefined, 'https://dzduino.dz'), undefined);

    /* ----------------------------------------------------- contact rows */

    const row = {value: '+213 550 88 00 00', label: {en: 'Sales', ar: 'المبيعات'}};
    eq('a contact label resolves for the locale', contactLabel(row, 'ar'), 'المبيعات');
    eq('a contact label falls back to English', contactLabel(row, 'fr'), 'Sales');
    eq(
        'a contact row with no label shows its value',
        contactLabel({value: 'store@dzduino.com'}, 'en'),
        'store@dzduino.com',
    );

    /* --------------------------------------------- hero slide link safety */

    // A slide's link is merchant input from another application, so it goes
    // through the same validator as a push payload. A banner must either
    // navigate or be inert; a tap that silently does nothing reads as a bug.
    eq(
        'a collection slug becomes a real route',
        resolveAppUrl({url: '/collection/robotics'}),
        '/collection/robotics',
    );
    eq(
        'a merchant-set external link is refused',
        resolveAppUrl({url: 'https://promo.example/sale'}),
        null,
    );
    eq(
        'a web-only path with no app route is refused',
        resolveAppUrl({url: '/customizer'}),
        null,
    );
    eq('a slide with no link stays inert', resolveAppUrl({url: undefined}), null);

    done();
}
