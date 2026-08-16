/**
 * Dependency-free test harness, mirroring the web storefront's `tests/run.mjs`.
 *
 * Each `*.test.ts` is bundled with esbuild and executed in Node. Bundling
 * rather than relying on Node's TS support means the `@/*` path alias and the
 * gql.tada documents resolve exactly as they do in the app.
 *
 * Bundles are written under `tests/.bundles/` so any package marked external
 * resolves against the project's own `node_modules`.
 *
 * Run everything:      npm test
 * Run one file:        node tests/run.mjs <substring>
 */

import {build} from 'esbuild';
import {readdirSync, mkdirSync, rmSync, readFileSync, existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const testsDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testsDir, '..');
const bundleDir = join(testsDir, '.bundles');

/**
 * Load `.env` into `process.env`. Expo does this for the app automatically;
 * the harness runs in plain Node, so contract tests would otherwise have no
 * API url or channel token and would silently self-skip.
 */
const envFile = join(projectRoot, '.env');
if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split('\n')) {
        const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
        if (match && !process.env[match[1]]) {
            process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
        }
    }
}

const filter = process.argv[2];

const testFiles = readdirSync(testsDir)
    .filter(f => f.endsWith('.test.ts'))
    .filter(f => !filter || f.includes(filter))
    .sort();

if (testFiles.length === 0) {
    console.error(filter ? `No test files match "${filter}"` : 'No test files found');
    process.exit(1);
}

rmSync(bundleDir, {recursive: true, force: true});
mkdirSync(bundleDir, {recursive: true});

let failed = 0;
let passed = 0;

for (const file of testFiles) {
    const outfile = join(bundleDir, file.replace(/\.ts$/, '.mjs'));

    try {
        await build({
            entryPoints: [join(testsDir, file)],
            bundle: true,
            platform: 'node',
            format: 'esm',
            target: 'node22',
            outfile,
            absWorkingDir: projectRoot,
            alias: {'@': join(projectRoot, 'src')},
            logLevel: 'silent',
        });
    } catch (error) {
        console.error(`\n  BUILD FAILED  ${file}`);
        for (const e of error.errors ?? []) {
            console.error(`    ${e.text}`);
            if (e.location) console.error(`      at ${e.location.file}:${e.location.line}`);
        }
        failed++;
        continue;
    }

    try {
        const mod = await import(pathToFileURL(outfile).href);
        if (typeof mod.run === 'function') await mod.run();
        console.log(`  PASS  ${file}`);
        passed++;
    } catch (error) {
        console.error(`\n  FAIL  ${file}`);
        console.error(`    ${error instanceof Error ? error.message : String(error)}`);
        failed++;
    }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
