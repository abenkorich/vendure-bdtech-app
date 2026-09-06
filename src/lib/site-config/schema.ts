import {z} from 'zod';

/**
 * Site configuration the app actually renders.
 *
 * The storefront's published config is ~85 KB and describes a *web* home page:
 * testimonials, Instagram embeds, FAQ accordions, custom HTML sections. This
 * schema deliberately covers only the parts the app uses, and `.passthrough()`
 * is NOT used, so anything else is dropped at the parse boundary rather than
 * carried around and cached.
 *
 * Every field is optional or defaulted. A merchant editing the web customizer
 * must never be able to break the app's home screen by publishing a shape the
 * app did not expect, so parsing is total: unknown enum values fall back,
 * missing sections become empty, and the screen still renders.
 */

export const heroSlideSchema = z.object({
    id: z.string(),
    enabled: z.boolean().default(true),
    imageUrl: z.string().optional(),
    /** `left` | `center` | `right`; anything else is treated as `left`. */
    align: z.string().optional(),
    theme: z.string().optional(),
    overlayOpacity: z.number().min(0).max(1).default(0.45),
    copy: z
        .record(
            z.string(),
            z.object({
                eyebrow: z.string().optional(),
                title: z.string().optional(),
                subtitle: z.string().optional(),
                ctaLabel: z.string().optional(),
            }),
        )
        .optional(),
    href: z.string().optional(),
    collectionSlug: z.string().optional(),
});

export const heroSchema = z.object({
    autoplay: z.boolean().default(true),
    intervalMs: z.number().int().positive().default(4000),
    showDots: z.boolean().default(true),
    slides: z.array(heroSlideSchema).default([]),
});

export const popularCategoriesSchema = z.object({
    collectionSlugs: z.array(z.string()).default([]),
    featuredSlug: z.string().optional(),
    showViewMore: z.boolean().default(true),
});

export const searchConfigSchema = z.object({
    popularTerms: z.array(z.string()).default([]),
    categorySlugs: z.array(z.string()).default([]),
});

export const headerConfigSchema = z.object({
    siteName: z.string().optional(),
    showSiteName: z.boolean().default(false),
    logoUrl: z.string().optional(),
    logoDarkUrl: z.string().optional(),
});

/** A contact row: one address with a localized label. */
const contactRowSchema = z.object({
    id: z.string().optional(),
    value: z.string(),
    label: z.record(z.string(), z.string()).optional(),
});

export const storeInfoSchema = z.object({
    storeName: z.string().optional(),
    emails: z.array(contactRowSchema).default([]),
    phones: z.array(contactRowSchema).default([]),
});

/* ------------------------------------------------------------ home sections */

/**
 * The home screen below the pinned search bar, as the merchant composed it in
 * the customizer's Mobile app pane. Unknown section kinds are dropped rather
 * than rendered as something else, so a newer customizer cannot break an
 * older app; a missing list falls back to the order the app always had.
 */
export const homeSectionKeys = ['hero', 'banner', 'rail', 'categoryGrid', 'blog'] as const;
export type HomeSectionKey = (typeof homeSectionKeys)[number];

export const railSourceKeys = ['newArrivals', 'deals', 'collection', 'manual'] as const;
export type RailSource = (typeof railSourceKeys)[number];

export const railSortKeys = ['default', 'name-asc', 'price-asc', 'price-desc'] as const;
export type RailSort = (typeof railSortKeys)[number];

const sectionCopySchema = z
    .record(
        z.string(),
        z.object({
            eyebrow: z.string().optional(),
            title: z.string().optional(),
            subtitle: z.string().optional(),
        }),
    )
    .default({});

export const bannerSectionSchema = z.object({
    imageUrl: z.string().optional(),
    href: z.string().optional(),
    overlayOpacity: z.number().min(0).max(1).default(0.35),
    copy: sectionCopySchema,
});

export const railSectionSchema = z.object({
    source: z.enum(railSourceKeys).catch('collection'),
    collectionSlug: z.string().optional(),
    sort: z.enum(railSortKeys).catch('default'),
    productSlugs: z.array(z.string()).default([]),
    take: z.number().int().min(1).max(24).catch(12),
    copy: sectionCopySchema,
});

export const homeSectionSchema = z.object({
    id: z.string(),
    key: z.enum(homeSectionKeys),
    banner: bannerSectionSchema.optional(),
    rail: railSectionSchema.optional(),
});

export type HomeSection = z.infer<typeof homeSectionSchema>;
export type BannerSection = z.infer<typeof bannerSectionSchema>;
export type RailSection = z.infer<typeof railSectionSchema>;

/** The order the app shipped with, used when the config carries no list. */
export function defaultHomeSections(): HomeSection[] {
    return [
        {id: 'hero', key: 'hero'},
        {id: 'rail-new-arrivals', key: 'rail', rail: railSectionSchema.parse({source: 'newArrivals'})},
        {id: 'rail-deals', key: 'rail', rail: railSectionSchema.parse({source: 'deals'})},
        {id: 'category-grid', key: 'categoryGrid'},
        {id: 'blog', key: 'blog'},
    ];
}

/**
 * A list is parsed item by item: one malformed section is dropped, not the
 * whole list, since the rest of the screen is still worth rendering.
 */
const homeSectionsSchema = z
    .array(z.unknown())
    .transform(items =>
        items
            .map(item => homeSectionSchema.safeParse(item))
            .filter(result => result.success)
            .map(result => result.data),
    );

export const homeSchema = z
    .object({
        sections: homeSectionsSchema.optional(),
    })
    .transform(home => ({sections: home.sections ?? defaultHomeSections()}));

export type HomeConfig = z.infer<typeof homeSchema>;

export const appSiteConfigSchema = z.object({
    home: homeSchema.prefault({}),
    hero: heroSchema.default({autoplay: true, intervalMs: 4000, showDots: true, slides: []}),
    popularCategories: popularCategoriesSchema.default({collectionSlugs: [], showViewMore: true}),
    search: searchConfigSchema.default({popularTerms: [], categorySlugs: []}),
    header: headerConfigSchema.default({showSiteName: false}),
    storeInfo: storeInfoSchema.default({emails: [], phones: []}),
});

export type HeroSlide = z.infer<typeof heroSlideSchema>;
export type HeroConfig = z.infer<typeof heroSchema>;
export type PopularCategoriesConfig = z.infer<typeof popularCategoriesSchema>;
export type SearchConfig = z.infer<typeof searchConfigSchema>;
export type HeaderConfig = z.infer<typeof headerConfigSchema>;
export type ContactRow = z.infer<typeof contactRowSchema>;
export type StoreInfo = z.infer<typeof storeInfoSchema>;
export type AppSiteConfig = z.infer<typeof appSiteConfigSchema>;

/** Copy for a banner or rail in the active locale, falling back to English. */
export function sectionCopy(
    copy: Record<string, {eyebrow?: string; title?: string; subtitle?: string}> | undefined,
    locale: string,
): {eyebrow?: string; title?: string; subtitle?: string} {
    return copy?.[locale] ?? copy?.en ?? {};
}

/**
 * Parse a payload from `/api/site-config`, never throwing.
 *
 * Returns defaults on any malformed input. Callers that want to know it
 * happened can compare against `appSiteConfigSchema.parse({})`, or use
 * `parseSiteConfigVerbose`.
 *
 * A malformed or unexpected config must degrade to defaults, not to a crashed
 * home screen: this data is edited by a merchant in another application and
 * arrives over the network, so it is the least trustworthy input the app has.
 */
export function parseSiteConfig(raw: unknown): AppSiteConfig {
    const result = appSiteConfigSchema.safeParse(raw);
    if (result.success) return result.data;

    // Deliberately no `__DEV__` guard here: this module is pure so it can be
    // unit-tested, and `__DEV__` is a React Native global that does not exist
    // in the Node test harness. The caller logs; this just degrades.
    return appSiteConfigSchema.parse({});
}

/**
 * Parse, reporting whether the payload was usable.
 *
 * Split from `parseSiteConfig` so the app can log a bad config in development
 * without this module importing anything platform-specific.
 */
export function parseSiteConfigVerbose(raw: unknown): {
    config: AppSiteConfig;
    ok: boolean;
    issues: string[];
} {
    const result = appSiteConfigSchema.safeParse(raw);
    if (result.success) return {config: result.data, ok: true, issues: []};

    return {
        config: appSiteConfigSchema.parse({}),
        ok: false,
        issues: result.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`),
    };
}

/** Slides a merchant has enabled, in order. */
export function enabledSlides(hero: HeroConfig): HeroSlide[] {
    return hero.slides.filter(slide => slide.enabled);
}

/**
 * Copy for a slide in the active locale.
 *
 * The stored config carries every locale (including some the app does not
 * ship, such as `de`), so this picks the active one and falls back to English
 * rather than rendering an empty banner.
 */
export function slideCopy(
    slide: HeroSlide,
    locale: string,
): {eyebrow?: string; title?: string; subtitle?: string; ctaLabel?: string} {
    return slide.copy?.[locale] ?? slide.copy?.en ?? {};
}

/**
 * A contact row's label in the active locale, falling back to English and
 * then to the address itself, so a row always renders something meaningful.
 */
export function contactLabel(row: ContactRow, locale: string): string {
    return row.label?.[locale] ?? row.label?.en ?? row.value;
}

/**
 * Resolve a customizer asset path against the storefront origin.
 *
 * The customizer stores banner and logo paths relative to the *web* root
 * (`/customizer/banners/x.jpg`), which resolves to nothing on a phone. Every
 * image that comes out of site config has to go through this; forgetting it
 * produces a silently blank image rather than an error.
 */
export function absoluteAsset(url: string | undefined, base: string): string | undefined {
    if (!url) return undefined;
    if (/^https?:\/\//i.test(url)) return url;

    const origin = base.replace(/\/$/, '');
    return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}
