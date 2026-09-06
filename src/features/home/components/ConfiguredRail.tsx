import {router} from 'expo-router';
import {useLocale} from '@/i18n';
import {useRailProducts} from '@/features/home/queries';
import {sectionCopy, type RailSection} from '@/lib/site-config/schema';
import {S, tr} from '@/features/catalogue-strings';
import {ProductRail} from './ProductRail';

/**
 * A merchant-configured product rail.
 *
 * Titles come from the customizer in the active locale. A rail the merchant
 * left untitled still needs a heading, so the two backend-driven sources fall
 * back to the copy the app has always used for them, and a collection or
 * hand-picked rail falls back to "Featured products".
 */
export interface ConfiguredRailProps {
    rail: RailSection;
}

export function ConfiguredRail({rail}: ConfiguredRailProps) {
    const {locale} = useLocale();
    const result = useRailProducts(rail);
    const copy = sectionCopy(rail.copy, locale);

    const fallback =
        rail.source === 'newArrivals'
            ? {eyebrow: S.newArrivalsEyebrow, title: S.newArrivalsTitle}
            : rail.source === 'deals'
              ? {eyebrow: S.dealsTitle, title: S.dealsTitle, subtitle: S.dealsSubtitle}
              : {
                    eyebrow: tr('HomeSections.featured.eyebrow'),
                    title: tr('HomeSections.featured.title'),
                };

    const slug = rail.source === 'collection' ? rail.collectionSlug?.trim() : undefined;

    return (
        <ProductRail
            eyebrow={copy.eyebrow ?? fallback.eyebrow}
            title={copy.title ?? fallback.title}
            subtitle={copy.subtitle ?? fallback.subtitle}
            products={result.data?.products}
            isLoading={result.isPending}
            error={result.error}
            onRetry={() => void result.refetch()}
            onViewAll={slug ? () => router.push(`/collection/${slug}`) : undefined}
            // New arrivals is the one rail that should show its header even
            // while empty: an empty catalogue is news, an empty deals rail
            // is Tuesday.
            hideWhenEmpty={rail.source !== 'newArrivals'}
        />
    );
}
