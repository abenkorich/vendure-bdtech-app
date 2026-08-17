import {translate} from '@/i18n/translate';
import {check, eq, done} from './harness';

/**
 * Every message path used by the catalogue UI must resolve in all three
 * locales.
 *
 * `translate` returns the key path when a key is missing. That is visible on
 * screen but easy to miss in a language nobody on the team reads, so this
 * turns it into a test failure instead.
 *
 * The paths are duplicated from `features/catalogue-strings.ts` rather than
 * imported: that module reads the *active* locale, which needs React Native.
 */
const PATHS = [
    'HomeSections.viewAll',
    'HomeSections.newArrivals.eyebrow',
    'HomeSections.newArrivals.title',
    'Merchandising.dealsTitle',
    'Merchandising.dealsSubtitle',
    'HomeSections.categories.eyebrow',
    'HomeSections.categories.title',
    'HomeSections.blog.eyebrow',
    'HomeSections.blog.title',
    'HomeSections.blog.minRead',
    'Collections.pageTitle',
    'Collections.empty',
    'Collections.subCollections',
    'Collections.viewCollection',
    'Sort.placeholder',
    'Sort.nameAsc',
    'Sort.nameDesc',
    'Sort.priceAsc',
    'Sort.priceDesc',
    'Product.inStock',
    'Product.outOfStock',
    'Product.lowStock',
    'Product.addToCart',
    'Product.adding',
    'Product.addedToCart',
    'Product.selectOptions',
    'Product.descriptionTitle',
    'Product.relatedProducts',
    'Product.relatedEyebrow',
    'Product.from',
    'Common.sku',
    'Common.loading',
    'Common.language',
    'Common.restartToApplyDirection',
    'Common.restartNow',
    'Errors.somethingWentWrong',
    'Errors.tryAgain',
    'Errors.unexpectedError',
    'Errors.serverUnreachableTitle',
    'Errors.serverUnreachableBody',
    'Errors.failedAddToCart',
    'Search.noResults',
    'Navigation.home',
    'Navigation.shop',
    'Navigation.search',
    'Navigation.cart',
    'Navigation.account',
] as const;

export async function run(): Promise<void> {
    for (const locale of ['en', 'fr', 'ar'] as const) {
        const unresolved = PATHS.filter(path => translate(locale, '', path) === path);
        check(
            `every catalogue string resolves in ${locale}`,
            unresolved.length === 0,
            unresolved.join(', '),
        );
    }

    eq('English is correct', translate('en', '', 'Product.addToCart'), 'Add to Cart');
    eq('French is translated', translate('fr', '', 'Navigation.cart'), 'Panier');
    eq('Arabic is translated', translate('ar', '', 'Navigation.home'), 'الرئيسية');
    done();
}
