import assert from 'node:assert/strict';
import en from '../messages/en.json';
import fr from '../messages/fr.json';
import ar from '../messages/ar.json';

/**
 * The three catalogs must expose exactly the same keys.
 *
 * A missing key does not throw at runtime, it renders the raw key path into
 * the UI, so this is the only cheap way to catch a half-translated string
 * before a user sees `Product.addToCart` on a button. Ported from the web
 * storefront, where the same guard exists.
 */

type Catalog = Record<string, unknown>;

function flatten(value: Catalog, prefix = ''): string[] {
    return Object.entries(value).flatMap(([key, child]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return child !== null && typeof child === 'object' && !Array.isArray(child)
            ? flatten(child as Catalog, path)
            : [path];
    });
}

export async function run(): Promise<void> {
    const catalogs = {en, fr, ar} as Record<string, Catalog>;
    const keys = Object.fromEntries(
        Object.entries(catalogs).map(([locale, catalog]) => [
            locale,
            new Set(flatten(catalog)),
        ]),
    );

    const reference = keys.en!;
    assert.ok(reference.size > 2000, `en has ${reference.size} keys, expected >2000`);

    for (const locale of ['fr', 'ar'] as const) {
        const missing = [...reference].filter(key => !keys[locale]!.has(key));
        const extra = [...keys[locale]!].filter(key => !reference.has(key));

        assert.deepEqual(missing, [], `${locale} is missing keys: ${missing.slice(0, 10)}`);
        assert.deepEqual(extra, [], `${locale} has keys absent from en: ${extra.slice(0, 10)}`);
    }
}
