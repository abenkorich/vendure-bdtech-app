import {check, done} from './harness';

/**
 * The plural rules that run **on the device**, not the ones Node happens to
 * have.
 *
 * `catalogue-strings.test.ts` pins the Arabic dual, and its comment claimed
 * that proved the Hermes path. It did not. Node ships a complete `Intl`, so
 * that test exercises V8's ICU and would pass just as happily on a build where
 * the polyfill was missing, misordered, or loaded without Arabic locale data.
 * Hermes has no `Intl.PluralRules` at all, so the code path that decides
 * "منتجان" on a phone is `@formatjs/intl-pluralrules`, which that test never
 * touches.
 *
 * This removes `Intl.PluralRules`, loads the polyfill exactly as `index.js`
 * does, and compares every category against real ICU. A missing locale-data
 * import silently degrades to English rules, which would turn the dual into
 * "2 منتج" — wrong, but plausible enough to ship.
 */

export async function run(): Promise<void> {
    const {createRequire} = await import('node:module');
    const require = createRequire(`${process.cwd()}/`);

    const real = Intl.PluralRules;
    check('the test environment has real ICU to compare against', typeof real === 'function');

    // @ts-expect-error deliberately removing the API to force the polyfill in.
    delete Intl.PluralRules;

    try {
        require('@formatjs/intl-pluralrules/polyfill-force.js');
        // Same three locales, same order, as src/lib/intl-polyfill.ts.
        require('@formatjs/intl-pluralrules/locale-data/en.js');
        require('@formatjs/intl-pluralrules/locale-data/fr.js');
        require('@formatjs/intl-pluralrules/locale-data/ar.js');

        check(
            'the polyfill installs Intl.PluralRules where the engine has none',
            typeof Intl.PluralRules === 'function',
        );

        const mismatches: string[] = [];
        for (const locale of ['en', 'fr', 'ar'] as const) {
            for (const count of [0, 1, 2, 3, 6, 11, 100, 190]) {
                const viaPolyfill = new Intl.PluralRules(locale).select(count);
                const viaIcu = new real(locale).select(count);
                if (viaPolyfill !== viaIcu) {
                    mismatches.push(`${locale}/${count}: ${viaPolyfill} != ${viaIcu}`);
                }
            }
        }

        check(
            'polyfilled plural categories match real ICU in every shipped locale',
            mismatches.length === 0,
            mismatches.join(', '),
        );

        // The case a shopper sees, and the one English rules would get wrong.
        check(
            'Arabic resolves the dual category on the device engine',
            new Intl.PluralRules('ar').select(2) === 'two',
            `got ${new Intl.PluralRules('ar').select(2)}`,
        );
    } finally {
        (Intl as {PluralRules: typeof real}).PluralRules = real;
    }

    done();
}
