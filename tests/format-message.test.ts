import {formatMessage} from '@/i18n/format-message';
import {check, eq, done} from './harness';
import {readFileSync, existsSync} from 'node:fs';

/**
 * Checks for the ICU message formatter, including a sweep over the real
 * en/fr/ar catalogs to prove every message in the shipped translations
 * renders without throwing.
 *
 * Run with: node tests/run.mjs
 */


// literals and interpolation
eq('plain text passes through', formatMessage('Hello world'), 'Hello world');
eq('single placeholder', formatMessage('Hi {name}', {name: 'Sam'}), 'Hi Sam');
eq(
    'multiple placeholders',
    formatMessage('{a} and {b} and {a}', {a: 'x', b: 'y'}),
    'x and y and x',
);
eq('missing value renders empty', formatMessage('Hi {name}!', {}), 'Hi !');
eq('numeric value', formatMessage('{n} items', {n: 5}), '5 items');

// plurals (the exact shapes used in the catalogs)
const reviews = 'Based on {count, plural, one {# review} other {# reviews}}';
eq('plural one', formatMessage(reviews, {count: 1}, 'en'), 'Based on 1 review');
eq('plural other', formatMessage(reviews, {count: 7}, 'en'), 'Based on 7 reviews');
eq('plural zero -> other in en', formatMessage(reviews, {count: 0}, 'en'), 'Based on 0 reviews');

const withExplicitZero =
    '{count, plural, =0 {No products in this collection} one {# product in this collection} other {# products in this collection}}';
eq(
    'explicit =0 branch wins',
    formatMessage(withExplicitZero, {count: 0}, 'en'),
    'No products in this collection',
);
eq(
    'plural one with explicit zero present',
    formatMessage(withExplicitZero, {count: 1}, 'en'),
    '1 product in this collection',
);
eq(
    'plural other with explicit zero present',
    formatMessage(withExplicitZero, {count: 12}, 'en'),
    '12 products in this collection',
);

// locale-aware plural categories
eq('french plural one covers 0', formatMessage('{count, plural, one {# article} other {# articles}}', {count: 0}, 'fr'), '0 article');
const arabic = '{count, plural, zero {لا عناصر} one {عنصر واحد} two {عنصران} few {# عناصر} many {# عنصرا} other {# عنصر}}';
check('arabic selects "two" for 2', formatMessage(arabic, {count: 2}, 'ar') === 'عنصران', formatMessage(arabic, {count: 2}, 'ar'));
check('arabic selects "few" for 3', formatMessage(arabic, {count: 3}, 'ar').includes('عناصر'), formatMessage(arabic, {count: 3}, 'ar'));

// number formatting of #
eq('# uses locale number format', formatMessage('{count, plural, other {# items}}', {count: 1234}, 'en'), '1,234 items');

// select: keyword branches, with `other` as the catch-all ICU requires
{
    const pick = '{gender, select, male {he} female {she} other {they}}';
    eq('select matches a branch', formatMessage(pick, {gender: 'male'}), 'he');
    eq('select falls back to other', formatMessage(pick, {gender: 'robot'}), 'they');
    // The catalogs' own `Errors.invalidCredentials` renders with no value at
    // all: the sign-in field takes an email *or* a mobile, so the caller often
    // does not know which was typed and the neutral branch is the right one.
    eq('select with no value takes other', formatMessage(pick, {}), 'they');
    eq(
        'select composes with surrounding text',
        formatMessage('Invalid {kind, select, email {email} other {email or mobile}} or password.', {
            kind: 'email',
        }),
        'Invalid email or password.',
    );
}

// unsupported ICU still fails loudly instead of mis-rendering
{
    let threw = false;
    try {
        formatMessage('{when, date, short}', {when: 0});
    } catch {
        threw = true;
    }
    check('unsupported {date} throws', threw);
}

// malformed input degrades safely
eq('unmatched brace emitted literally', formatMessage('50% off {sale', {}), '50% off {sale');

// sweep the real catalogs
{
    const localeDirs = ['messages/en.json', 'messages/fr.json', 'messages/ar.json'];
    let scanned = 0;
    const errors: string[] = [];

    for (const path of localeDirs) {
        if (!existsSync(path)) {
            console.log(`  --  skipped ${path} (not present)`);
            continue;
        }
        const locale = path.includes('/fr') ? 'fr' : path.includes('/ar') ? 'ar' : 'en';
        const catalog = JSON.parse(readFileSync(path, 'utf8'));

        const walk = (node: unknown, keyPath: string) => {
            if (typeof node === 'string') {
                scanned += 1;
                try {
                    // Feed plausible values for any placeholders present.
                    const values: Record<string, string | number> = {};
                    for (const match of node.matchAll(/\{(\w+)/g)) {
                        const name = match[1]!;
                        values[name] = /count|total|num|qty|days|minutes|max|min/i.test(name) ? 2 : 'X';
                    }
                    formatMessage(node, values, locale);
                } catch (error) {
                    errors.push(`${locale}:${keyPath} — ${(error as Error).message}`);
                }
            } else if (node && typeof node === 'object') {
                for (const [key, value] of Object.entries(node)) {
                    walk(value, keyPath ? `${keyPath}.${key}` : key);
                }
            }
        };
        walk(catalog, '');
    }

    check(
        `all ${scanned} catalog messages format without error`,
        errors.length === 0,
        errors.slice(0, 10).join('\n      '),
    );
}

export async function run(): Promise<void> {
    done();
}
