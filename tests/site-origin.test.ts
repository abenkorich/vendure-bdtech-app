import {check, done} from './harness';

/**
 * The configured site origin must actually serve a valid certificate.
 *
 * `dzduino.dz` and `www.dzduino.dz` are not interchangeable: the bare host
 * serves Traefik's default self-signed certificate ("CN=TRAEFIK DEFAULT
 * CERT"), which fails verification on both platforms, while `www` has a real
 * one. The app had the bare host configured.
 *
 * Nothing caught it because the failure is invisible today: the site-config
 * endpoint is not deployed yet, so the app falls back to its bundled snapshot
 * and looks perfectly healthy. The moment the storefront ships, that origin is
 * also where every customizer image resolves, so a wrong host does not degrade
 * gracefully — it blanks the hero and the category strip.
 *
 * Skips when the network is unavailable so it never blocks an offline run.
 */

const ORIGIN = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://www.dzduino.dz';

export async function run(): Promise<void> {
    let reachable = true;
    let status = 0;

    try {
        const response = await fetch(`${ORIGIN}/`, {
            method: 'HEAD',
            redirect: 'manual',
            signal: AbortSignal.timeout(15_000),
        });
        status = response.status;
    } catch (error) {
        // `fetch` reports every failure as the same opaque "fetch failed"; the
        // reason is on `cause`. Matching the message would have made this test
        // pass against the very host it exists to reject.
        const cause = (error as {cause?: {code?: string; message?: string}}).cause;
        const code = cause?.code ?? '';
        const detail = cause?.message ?? String(error);

        const isTlsFailure =
            /CERT|SSL|TLS/i.test(code) || /certificate|self.signed/i.test(detail);

        check(
            `${ORIGIN} presents a valid certificate`,
            !isTlsFailure,
            `${code}: ${detail}`.slice(0, 200),
        );
        if (isTlsFailure) {
            done();
            return;
        }
        reachable = false;
    }

    if (!reachable) {
        check('site origin check skipped: host unreachable', true, ORIGIN);
        done();
        return;
    }

    check(
        `${ORIGIN} responds over TLS (status ${status})`,
        status > 0 && status < 500,
        `status ${status}`,
    );

    done();
}
