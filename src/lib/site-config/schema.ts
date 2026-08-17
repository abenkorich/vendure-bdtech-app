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

export const appSiteConfigSchema = z.object({
    hero: heroSchema.default({autoplay: true, intervalMs: 4000, showDots: true, slides: []}),
    popularCategories: popularCategoriesSchema.default({collectionSlugs: [], showViewMore: true}),
    search: searchConfigSchema.default({popularTerms: [], categorySlugs: []}),
    header: headerConfigSchema.default({showSiteName: false}),
});

export type HeroSlide = z.infer<typeof heroSlideSchema>;
export type HeroConfig = z.infer<typeof heroSchema>;
export type PopularCategoriesConfig = z.infer<typeof popularCategoriesSchema>;
export type SearchConfig = z.infer<typeof searchConfigSchema>;
export type HeaderConfig = z.infer<typeof headerConfigSchema>;
export type AppSiteConfig = z.infer<typeof appSiteConfigSchema>;

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
