import {resolveNotificationUrl, NOTIFICATION_ROUTES} from '@/lib/notification-routes';
import {check, eq, done} from './harness';

/**
 * A notification's destination is chosen by the backend, so it is untrusted
 * input arriving on the one code path that runs before the user has done
 * anything. `router.push` to a path the app does not serve is a silent no-op,
 * so a bad payload is indistinguishable from a broken app.
 */
export async function run(): Promise<void> {
    /* ------------------------------------------------------------ accepted */

    eq('a static route', resolveNotificationUrl({url: '/cart'}), '/cart');
    eq('the root route', resolveNotificationUrl({url: '/'}), '/');
    eq(
        'a dynamic route',
        resolveNotificationUrl({url: '/order/ABC123'}),
        '/order/ABC123',
    );
    eq(
        'a nested dynamic route',
        resolveNotificationUrl({url: '/account/orders/XYZ789'}),
        '/account/orders/XYZ789',
    );
    eq(
        'a slug containing dots (product slugs do: esp32-v1.2)',
        resolveNotificationUrl({url: '/product/esp32-v1.2'}),
        '/product/esp32-v1.2',
    );
    eq(
        'a query string survives',
        resolveNotificationUrl({url: '/search?q=esp32'}),
        '/search?q=esp32',
    );
    eq(
        'a trailing slash still matches',
        resolveNotificationUrl({url: '/cart/'}),
        '/cart/',
    );
    eq(
        'surrounding whitespace is tolerated',
        resolveNotificationUrl({url: '  /wishlist  '}),
        '/wishlist',
    );

    /* ------------------------------------------------------------ rejected */

    eq('no payload', resolveNotificationUrl(undefined), null);
    eq('null payload', resolveNotificationUrl(null), null);
    eq('payload without a url', resolveNotificationUrl({title: 'Shipped'}), null);
    eq('a non-string url', resolveNotificationUrl({url: 42}), null);
    eq('an empty url', resolveNotificationUrl({url: ''}), null);

    eq(
        'an external https url',
        resolveNotificationUrl({url: 'https://evil.example/cart'}),
        null,
    );
    eq(
        'a custom scheme',
        resolveNotificationUrl({url: 'dzduino://cart'}),
        null,
    );
    eq(
        'a protocol-relative url',
        resolveNotificationUrl({url: '//evil.example/cart'}),
        null,
    );
    eq(
        'path traversal',
        resolveNotificationUrl({url: '/product/../../etc/passwd'}),
        null,
    );
    eq(
        'a route the app does not serve',
        resolveNotificationUrl({url: '/admin'}),
        null,
    );
    eq(
        'a typo in a real route (the likeliest failure)',
        resolveNotificationUrl({url: '/carts'}),
        null,
    );
    eq(
        'a dynamic route missing its parameter',
        resolveNotificationUrl({url: '/order/'}),
        null,
    );
    eq(
        'extra path depth beyond a dynamic route',
        resolveNotificationUrl({url: '/order/ABC123/refund'}),
        null,
    );

    /* --------------------------------------------------------- consistency */

    check(
        'every declared route is itself accepted',
        NOTIFICATION_ROUTES.every(route => {
            const concrete = route.replace(/:[a-z]+/gi, 'sample');
            return resolveNotificationUrl({url: concrete}) === concrete;
        }),
        NOTIFICATION_ROUTES.filter(route => {
            const concrete = route.replace(/:[a-z]+/gi, 'sample');
            return resolveNotificationUrl({url: concrete}) !== concrete;
        }).join(', '),
    );

    done();
}
