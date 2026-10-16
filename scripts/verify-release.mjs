/**
 * Check a release artifact before it is uploaded or installed.
 *
 * Every assertion here exists because the thing it checks went wrong at least
 * once while preparing the first release:
 *
 * - **The channel token.** `EXPO_PUBLIC_*` is inlined at build time, so a
 *   wrong `.env` produces a build that compiles, installs, launches, and then
 *   fails every catalogue request with CHANNEL_NOT_FOUND. The token is read
 *   back out of the artifact and resolved against the live Shop API, because
 *   reading `.env` would only prove what the *next* build will carry.
 * - **The signer.** `plugins/with-release-signing.js` falls back to the debug
 *   keystore when the `DZDUINO_UPLOAD_*` gradle properties are missing, so a
 *   bundle can be built, signed, and rejected by Play with nothing in the
 *   build log to say why.
 * - **versionCode.** Play refuses a code it has already accepted and the
 *   number can never be reused, so it is worth reading rather than assuming.
 *
 * Usage: `npm run verify:release` — checks whichever of the .aab and .apk
 * exist. Exits non-zero when something is wrong, so it can gate an upload.
 */
import {execFileSync} from 'node:child_process';
import {existsSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';

const AAB = 'android/app/build/outputs/bundle/release/app-release.aab';
const APK = 'android/app/build/outputs/apk/release/app-release.apk';

/** JDK 17: anything newer breaks this project's Android tooling (AGENTS.md). */
const JAVA_HOME = process.env.JAVA_HOME || '/opt/homebrew/opt/openjdk@17';
const KEYTOOL = join(JAVA_HOME, 'bin', 'keytool');

const problems = [];
const notes = [];

function run(file, args) {
    return execFileSync(file, args, {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        // `apksigner` is a shell wrapper that invokes `java`, so it needs a
        // JDK on the PATH. Without this it hits macOS's stub and reports
        // "Unable to locate a Java Runtime", which says nothing about signing.
        env: {...process.env, JAVA_HOME, PATH: `${join(JAVA_HOME, 'bin')}:${process.env.PATH}`},
    });
}

function megabytes(path) {
    return `${(statSync(path).size / 1024 / 1024).toFixed(0)} MB`;
}

/** `app.config` sits at a different path in a bundle than in an apk. */
function readConfig(archive, entry) {
    try {
        return JSON.parse(run('unzip', ['-p', archive, entry]));
    } catch {
        problems.push(`${archive}: could not read ${entry}`);
        return null;
    }
}

/**
 * The owner line of whatever certificate signed the archive, or null when it
 * cannot be read — a missing JDK must not look like a signing problem, and
 * must not take the rest of the checks down with it.
 */
function readSigner(archive) {
    try {
        return signerOf(archive);
    } catch (error) {
        notes.push(`${archive}: could not read the signer (${error.message.split('\n')[0]})`);
        return null;
    }
}

function signerOf(archive) {
    if (archive.endsWith('.aab')) {
        // A bundle keeps a JAR signature, which keytool can read.
        const out = run(KEYTOOL, ['-printcert', '-jarfile', archive]);
        return /Owner:\s*(.+)/.exec(out)?.[1]?.trim() ?? 'unknown';
    }
    // A modern apk carries only v2/v3 signatures, invisible to keytool.
    const buildTools = join(process.env.HOME ?? '', 'Library/Android/sdk/build-tools');
    // Numeric-aware, so 36.0.0 beats 9.0.0 rather than losing to it.
    const newest = readdirSync(buildTools)
        .sort((a, b) => a.localeCompare(b, undefined, {numeric: true}))
        .pop();
    const out = run(join(buildTools, newest, 'apksigner'), ['verify', '--print-certs', archive]);
    return /certificate DN:\s*(.+)/.exec(out)?.[1]?.trim() ?? 'unknown';
}

async function resolveChannel(api, token) {
    try {
        const response = await fetch(api, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'vendure-token': token},
            body: JSON.stringify({query: '{ activeChannel { id code } }'}),
        });
        const body = await response.json();
        return body?.data?.activeChannel ?? null;
    } catch (error) {
        notes.push(`could not reach ${api} to check the token: ${error.message}`);
        return undefined;
    }
}

async function inspect(archive, entry) {
    if (!existsSync(archive)) {
        notes.push(`${archive} — not built`);
        return;
    }

    console.log(`\n${archive}  (${megabytes(archive)})`);

    const config = readConfig(archive, entry);
    if (!config) return;

    const extra = config.extra ?? {};
    const android = config.android ?? {};
    console.log(`  version      ${config.version}  ·  versionCode ${android.versionCode}`);
    console.log(`  package      ${android.package}`);
    console.log(`  api          ${extra.vendureShopApiUrl}`);
    console.log(`  site         ${extra.siteUrl}`);

    const signer = readSigner(archive);
    if (signer) console.log(`  signer       ${signer}`);
    if (signer && /Android Debug/i.test(signer)) {
        problems.push(
            `${archive} is DEBUG-SIGNED — Play will reject it. Check the ` +
                `DZDUINO_UPLOAD_* properties in ~/.gradle/gradle.properties.`,
        );
    }

    const channel = await resolveChannel(extra.vendureShopApiUrl, extra.vendureChannelToken);
    if (channel === null) {
        console.log(`  channel      ${extra.vendureChannelToken}   NOT FOUND`);
        problems.push(
            `${archive} carries a channel token the API does not recognise ` +
                `(${extra.vendureChannelToken}). Every screen would fail with ` +
                `CHANNEL_NOT_FOUND. Fix .env and rebuild — prebuild bakes it in.`,
        );
    } else if (channel === undefined) {
        console.log(`  channel      ${extra.vendureChannelToken}   (unchecked)`);
    } else {
        console.log(
            `  channel      ${extra.vendureChannelToken}  ->  ${channel.id} "${channel.code}"`,
        );
    }
}

await inspect(AAB, 'base/assets/app.config');
await inspect(APK, 'assets/app.config');

if (notes.length) {
    console.log('');
    for (const note of notes) console.log(`note: ${note}`);
}

if (problems.length) {
    console.log('');
    for (const problem of problems) console.error(`FAIL: ${problem}`);
    process.exit(1);
}

if (!existsSync(AAB) && !existsSync(APK)) {
    console.error('\nFAIL: nothing to verify. Run npm run build:aab or npm run build:android.');
    process.exit(1);
}

console.log('\nAll checks passed.');
