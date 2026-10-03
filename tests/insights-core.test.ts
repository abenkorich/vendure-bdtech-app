import {appScreenUrl, createSearchReporter, randomId} from '@/lib/insights/insights-core';
import {check, eq, done} from './harness';

/**
 * The app's half of the backend's Customer insights reports. The device half
 * (`insights.ts`) needs React Native; this is everything that can be proven in
 * Node: how a screen is named in the report, and that a term typed letter by
 * letter is reported once.
 */
export async function run(): Promise<void> {
    eq('a screen path', appScreenUrl('/product/esp32-v1.2'), 'app:///product/esp32-v1.2');
    eq('the root', appScreenUrl('/'), 'app:///');
    eq('no pathname yet', appScreenUrl(undefined), 'app:///');
    eq('a relative path is rooted', appScreenUrl('cart'), 'app:///cart');
    eq(
        'the admin reads the path back with URL',
        new URL(appScreenUrl('/collection/arduino')).pathname,
        '/collection/arduino',
    );
    check('a long path is capped', appScreenUrl(`/${'x'.repeat(2000)}`).length === 1024);

    const a = randomId();
    const b = randomId();
    check('ids are unique', a !== b, [a, b]);
    check('ids fit the backend visitor id rule', /^[A-Za-z0-9_-]{8,64}$/.test(a), a);

    const sent: Array<[string, number]> = [];
    const reporter = createSearchReporter((term, count) => sent.push([term, count]), 30);
    reporter.report('e', 900);
    reporter.report('es', 400);
    reporter.report('esp32 ', 12.7);
    await new Promise(resolve => setTimeout(resolve, 80));
    eq('only the settled term is reported', JSON.stringify(sent), JSON.stringify([['esp32', 12]]));

    reporter.report('   ', 0);
    await new Promise(resolve => setTimeout(resolve, 60));
    eq('a blank term is not reported', sent.length, 1);

    reporter.report('servo', 0);
    reporter.cancel();
    await new Promise(resolve => setTimeout(resolve, 60));
    eq('a cancelled term is not reported', sent.length, 1);

    reporter.report('servo', -3);
    await new Promise(resolve => setTimeout(resolve, 60));
    eq('a negative count is clamped', JSON.stringify(sent[1]), JSON.stringify(['servo', 0]));

    done();
}
