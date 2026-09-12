/**
 * Minimal ICU MessageFormat evaluator covering exactly what the ported
 * translation catalogs use: `{placeholder}` substitution,
 * `{count, plural, =0 {...} one {# ...} other {# ...}}`, and
 * `{kind, select, a {...} other {...}}`.
 *
 * A full ICU library (intl-messageformat, ~40kB) would be the right call if
 * the catalogs grow date or number skeletons; today they are simple
 * interpolation plus a handful of plural and select forms, so this keeps the
 * client bundle small. `formatMessage` throws on syntax it does not
 * understand rather than silently mis-rendering, and `format-message.test.ts`
 * runs every string in all three catalogs through it — which is how a `select`
 * arriving in the catalogs before this supported one was caught.
 */

export type MessageValues = Record<string, string | number | boolean | null | undefined>;

const pluralRulesCache = new Map<string, Intl.PluralRules>();

function pluralRules(locale: string): Intl.PluralRules {
    let rules = pluralRulesCache.get(locale);
    if (!rules) {
        rules = new Intl.PluralRules(locale);
        pluralRulesCache.set(locale, rules);
    }
    return rules;
}

/** Find the index of the `}` matching the `{` at `open`. */
function matchBrace(input: string, open: number): number {
    let depth = 0;
    for (let i = open; i < input.length; i += 1) {
        const char = input[i];
        if (char === "'" && input[i + 1] === "'") {
            i += 1;
            continue;
        }
        if (char === '{') depth += 1;
        else if (char === '}') {
            depth -= 1;
            if (depth === 0) return i;
        }
    }
    return -1;
}

/** Parse `=0 {...} one {# x} other {# y}`, or a select's keyword branches. */
function parseBranches(body: string): Map<string, string> {
    const branches = new Map<string, string>();
    let index = 0;
    while (index < body.length) {
        while (index < body.length && /\s/.test(body[index]!)) index += 1;
        if (index >= body.length) break;

        const braceStart = body.indexOf('{', index);
        if (braceStart === -1) break;
        const selector = body.slice(index, braceStart).trim();
        const braceEnd = matchBrace(body, braceStart);
        if (braceEnd === -1) throw new Error(`Unbalanced braces in plural branch "${selector}"`);
        branches.set(selector, body.slice(braceStart + 1, braceEnd));
        index = braceEnd + 1;
    }
    return branches;
}

export function formatMessage(
    message: string,
    values: MessageValues = {},
    locale = 'en',
): string {
    if (!message.includes('{')) return message;

    let output = '';
    let index = 0;

    while (index < message.length) {
        const open = message.indexOf('{', index);
        if (open === -1) {
            output += message.slice(index);
            break;
        }
        output += message.slice(index, open);

        const close = matchBrace(message, open);
        if (close === -1) {
            // Unmatched brace: emit literally rather than dropping content.
            output += message.slice(open);
            break;
        }

        const inner = message.slice(open + 1, close);
        const commaIndex = inner.indexOf(',');

        if (commaIndex === -1) {
            // Simple {placeholder}
            const name = inner.trim();
            const value = values[name];
            output += value === undefined || value === null ? '' : String(value);
        } else {
            const name = inner.slice(0, commaIndex).trim();
            const rest = inner.slice(commaIndex + 1).trim();
            const typeMatch = /^(\w+)\s*,?\s*/.exec(rest);
            const type = typeMatch?.[1];

            if (type !== 'plural' && type !== 'selectordinal' && type !== 'select') {
                throw new Error(
                    `Unsupported ICU argument type "${type}" in message: ${message}. ` +
                        `Only {name}, {name, plural, ...} and {name, select, ...} are implemented.`,
                );
            }

            if (type === 'select') {
                // Plain keyword match, no plural rules and no `#`: the value
                // names the branch. A missing or unknown value takes `other`,
                // which ICU requires every select to define — so a caller that
                // passes nothing still gets a sentence rather than a blank.
                const branches = parseBranches(rest.slice(typeMatch![0].length));
                const selector = values[name];
                const key = selector === undefined || selector === null ? '' : String(selector);
                output += formatMessage(
                    branches.get(key) ?? branches.get('other') ?? '',
                    values,
                    locale,
                );
                index = close + 1;
                continue;
            }

            const raw = Number(values[name] ?? 0);
            const branches = parseBranches(rest.slice(typeMatch![0].length));
            const category =
                branches.get(`=${raw}`) !== undefined
                    ? branches.get(`=${raw}`)!
                    : (branches.get(pluralRules(locale).select(raw)) ?? branches.get('other') ?? '');

            // `#` inside a plural branch renders the localized number.
            output += formatMessage(
                category.replace(/#/g, new Intl.NumberFormat(locale).format(raw)),
                values,
                locale,
            );
        }

        index = close + 1;
    }

    return output;
}
