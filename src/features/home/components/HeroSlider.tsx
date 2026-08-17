import {useCallback, useEffect, useRef, useState} from 'react';
import {View, Pressable, ScrollView, useWindowDimensions, I18nManager} from 'react-native';
import {Image} from 'expo-image';
import {StyleSheet} from 'react-native-unistyles';
import {router} from 'expo-router';
import {Text, Skeleton} from '@/components/ui';
import {useLocale} from '@/i18n';
import {absoluteAsset, enabledSlides, slideCopy, type HeroConfig} from '@/lib/site-config/schema';
import {slideOffset, slideIndex} from '@/features/home/slide-paging';
import {resolveAppUrl} from '@/lib/notification-routes';

/**
 * Merchant-configured hero carousel.
 *
 * Slides, autoplay, interval and dots all come from the customizer, so this
 * shows whatever the merchant published for the web, with copy resolved for
 * the active locale.
 *
 * Autoplay pauses while the user is touching the carousel. Yanking a banner
 * out from under someone mid-swipe is the single most irritating thing a
 * carousel can do, and it is why so many people never touch them twice.
 */

export interface HeroSliderProps {
    hero: HeroConfig;
    /** Absolute base for the customizer's relative banner paths. */
    assetBaseUrl: string;
    isLoading?: boolean;
}

/** 16:9 is what the customizer's banner uploads are cropped to. */
const ASPECT = 16 / 9;

export function HeroSlider({hero, assetBaseUrl, isLoading = false}: HeroSliderProps) {
    const {locale} = useLocale();
    const {width} = useWindowDimensions();
    const scrollRef = useRef<ScrollView>(null);
    const [index, setIndex] = useState(0);
    const interacting = useRef(false);

    const slides = enabledSlides(hero);
    const height = width / ASPECT;

    /**
     * Slide index <-> scroll offset; mirrored under RTL. See `slide-paging`
     * for why, and for the tests that pin the round trip.
     */
    const offsetFor = useCallback(
        (index: number) => slideOffset(index, slides.length, width, I18nManager.isRTL),
        [slides.length, width],
    );
    const indexFrom = useCallback(
        (offset: number) => slideIndex(offset, slides.length, width, I18nManager.isRTL),
        [slides.length, width],
    );

    const goTo = useCallback(
        (next: number) => {
            scrollRef.current?.scrollTo({x: offsetFor(next), animated: true});
            setIndex(next);
        },
        [offsetFor],
    );

    useEffect(() => {
        if (!hero.autoplay || slides.length < 2) return;

        const timer = setInterval(() => {
            // Skip a tick rather than fighting the user's finger.
            if (interacting.current) return;
            setIndex(current => {
                const next = (current + 1) % slides.length;
                scrollRef.current?.scrollTo({x: offsetFor(next), animated: true});
                return next;
            });
        }, hero.intervalMs);

        return () => clearInterval(timer);
    }, [hero.autoplay, hero.intervalMs, slides.length, offsetFor]);

    if (isLoading && slides.length === 0) {
        return <Skeleton width="100%" height={height} radius="none" />;
    }

    if (slides.length === 0) return null;

    return (
        <View style={styles.root}>
            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onTouchStart={() => {
                    interacting.current = true;
                }}
                onTouchEnd={() => {
                    interacting.current = false;
                }}
                onMomentumScrollEnd={event => {
                    setIndex(indexFrom(event.nativeEvent.contentOffset.x));
                }}
            >
                {slides.map(slide => {
                    const copy = slideCopy(slide, locale);
                    // A slide's link is merchant input from another
                    // application, and `router.push` to a path this app does
                    // not serve is a silent no-op. The same validator the push
                    // payloads use rejects external urls, schemes and unknown
                    // routes, so a banner either navigates or is inert — never
                    // a tap that appears to do nothing.
                    const target = slide.collectionSlug
                        ? resolveAppUrl({url: `/collection/${slide.collectionSlug}`})
                        : resolveAppUrl({url: slide.href});

                    return (
                        <Pressable
                            key={slide.id}
                            accessibilityRole={target ? 'button' : 'image'}
                            accessibilityLabel={copy.title ?? undefined}
                            disabled={!target}
                            onPress={() => target && router.push(target as never)}
                            style={{width, height}}
                        >
                            {/* The brand plate sits under every slide. When the
                                image is missing or still loading — offline, or
                                a config service the app cannot reach — the
                                slide reads as a designed banner rather than a
                                black rectangle with text on it. */}
                            <View style={styles.plate} />

                            {slide.imageUrl ? (
                                <Image
                                    source={{uri: absoluteAsset(slide.imageUrl, assetBaseUrl)}}
                                    style={styles.image}
                                    contentFit="cover"
                                    transition={200}
                                />
                            ) : null}

                            {/* A scrim, sized by the merchant's overlayOpacity:
                                banner photos vary wildly and white text on a
                                pale product shot is unreadable without one. */}
                            <View
                                style={[
                                    styles.scrim,
                                    {backgroundColor: `rgba(0,0,0,${slide.overlayOpacity})`},
                                ]}
                            />

                            <View style={styles.copy}>
                                {copy.eyebrow ? (
                                    <Text variant="micro" style={styles.eyebrow} uppercase>
                                        {copy.eyebrow}
                                    </Text>
                                ) : null}
                                {copy.title ? (
                                    <Text variant="title" style={styles.title} numberOfLines={2}>
                                        {copy.title}
                                    </Text>
                                ) : null}
                                {copy.subtitle ? (
                                    <Text
                                        variant="caption"
                                        style={styles.subtitle}
                                        numberOfLines={2}
                                    >
                                        {copy.subtitle}
                                    </Text>
                                ) : null}
                            </View>
                        </Pressable>
                    );
                })}
            </ScrollView>

            {hero.showDots && slides.length > 1 ? (
                <View style={styles.dots} pointerEvents="box-none">
                    {slides.map((slide, dotIndex) => (
                        <Pressable
                            key={slide.id}
                            accessibilityRole="button"
                            accessibilityLabel={`${dotIndex + 1}`}
                            onPress={() => goTo(dotIndex)}
                            hitSlop={8}
                            style={[styles.dot, dotIndex === index && styles.dotActive]}
                        />
                    ))}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        marginBottom: theme.spacing.lg,
    },
    image: {
        ...StyleSheet.absoluteFillObject,
    },
    plate: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: theme.colors.brandMuted,
    },
    scrim: {
        ...StyleSheet.absoluteFillObject,
    },
    copy: {
        position: 'absolute',
        bottom: 0,
        start: 0,
        end: 0,
        padding: theme.spacing.lg,
        gap: theme.spacing.xs,
    },
    // Always light: the scrim guarantees a dark backdrop in both themes, so
    // these do not follow the colour scheme.
    eyebrow: {color: 'rgba(255,255,255,0.85)'},
    title: {color: '#ffffff'},
    subtitle: {color: 'rgba(255,255,255,0.9)'},
    dots: {
        position: 'absolute',
        bottom: theme.spacing.sm,
        start: 0,
        end: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: theme.spacing.xs,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: theme.radius.full,
        backgroundColor: 'rgba(255,255,255,0.45)',
    },
    dotActive: {
        width: 18,
        backgroundColor: '#ffffff',
    },
}));
