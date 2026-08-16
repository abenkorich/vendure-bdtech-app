/**
 * Tiny assertion harness, ported from the web storefront so its tests run here
 * unchanged.
 *
 * Deliberately dependency-free: these run through an esbuild bundle (see
 * `run.mjs`), and a real framework would pull its own resolution pipeline into
 * that path for no benefit at this size.
 *
 * `done()` throws on failure, which is what `run.mjs` reports on.
 */

let failures = 0;
let assertions = 0;

export function check(name: string, condition: boolean, detail?: unknown): void {
    assertions += 1;
    if (condition) return;
    failures += 1;
    console.error(`      FAIL  ${name}`, detail === undefined ? '' : detail);
}

export function eq<T>(name: string, actual: T, expected: T): void {
    check(
        name,
        Object.is(actual, expected),
        `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`,
    );
}

export function throws(name: string, fn: () => unknown): void {
    let threw = false;
    try {
        fn();
    } catch {
        threw = true;
    }
    check(name, threw, 'expected the call to throw');
}

export function done(): void {
    if (failures > 0) {
        throw new Error(`${failures} of ${assertions} assertions failed`);
    }
}
