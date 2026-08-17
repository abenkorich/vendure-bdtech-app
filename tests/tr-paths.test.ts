import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {translate} from '@/i18n/translate';
import {check, done} from './harness';

/**
 * Every `tr('...')` path in the app must resolve.
 *
 * `translate` returns the path itself when a key is missing, so a wrong path
 * renders as literal text instead of throwing. That is exactly what happened
 * on the collection screen: `tr('productsCount')` was missing its namespace
 * and shipped a sub-collection row reading "productsCount". Types cannot catch
 * it (the argument is just a string) and neither can a code review that
 * glances at a plausible-looking key.
 *
 * So this walks the source, extracts the literal paths, and resolves each one
 * in every locale. It only sees literals, which is the case that has actually
 * broken; a computed path is out of reach here and stays the caller's problem.
 */

const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
        else if (/\.tsx?$/.test(entry)) out.push(path);
    }
    return out;
}

export async function run(): Promise<void> {
    const paths = new Map<string, string>();

    for (const file of sourceFiles(SRC)) {
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(/\btr\(\s*'([^']+)'/g)) {
            paths.set(match[1]!, file);
        }
    }

    check('found tr() call sites to check', paths.size > 0, `found ${paths.size}`);

    for (const locale of ['en', 'fr', 'ar'] as const) {
        const unresolved = [...paths.entries()]
            .filter(([path]) => translate(locale, '', path) === path)
            .map(([path, file]) => `${path} (${file.replace(process.cwd(), '.')})`);

        check(
            `every tr() path resolves in ${locale}`,
            unresolved.length === 0,
            unresolved.join(', '),
        );
    }

    done();
}
