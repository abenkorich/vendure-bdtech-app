import {View, Pressable, useWindowDimensions} from 'react-native';
import {Image} from 'expo-image';
import {StyleSheet} from 'react-native-unistyles';
import {router} from 'expo-router';
import {Text} from '@/components/ui';
import {useLocale} from '@/i18n';
import {sectionCopy, type BannerSection} from '@/lib/site-config/schema';
import {siteImageSource} from '@/lib/site-config/bundled-assets';
import {resolveAppUrl} from '@/lib/notification-routes';
import {env} from '@/lib/env';

/**
 * A single merchant banner between the rails: one image, a line or two of
 * copy, an optional destination. The hero is for the top of the screen; this
 * is for "the sale is on" halfway down it.
 *
 * The link is merchant input from another application, so it goes through the
 * same validator the push payloads use: it either navigates or the banner is
 * inert, never a tap that appears to do nothing.
 */
export interface PromoBannerProps {
    banner: BannerSection;
}

const ASPECT = 16 / 7;

export function PromoBanner({banner}: PromoBannerProps) {
    const {locale} = useLocale();
    const {width} = useWindowDimensions();
    const source = siteImageSource(banner.imageUrl, env.siteUrl);
    if (!source) return null;

    const copy = sectionCopy(banner.copy, locale);
    const target = banner.href ? resolveAppUrl({url: banner.href}) : null;

    return (
        <View style={styles.root}>
            <Pressable
                accessibilityRole={target ? 'button' : 'image'}
                accessibilityLabel={copy.title}
                disabled={!target}
                onPress={() => target && router.push(target as never)}
                style={[styles.frame, {height: (width - 2 * styles.root.paddingHorizontal) / ASPECT}]}
            >
                <View style={styles.plate} />
                <Image source={source} style={styles.image} contentFit="cover" transition={200} />
                {copy.title || copy.subtitle || copy.eyebrow ? (
                    <>
                        <View
                            style={[styles.scrim, {backgroundColor: `rgba(0,0,0,${banner.overlayOpacity})`}]}
                        />
                        <View style={styles.copy}>
                            {copy.eyebrow ? (
                                <Text variant="micro" uppercase style={styles.onImageMuted}>
                                    {copy.eyebrow}
                                </Text>
                            ) : null}
                            {copy.title ? (
                                <Text variant="heading" style={styles.onImage} numberOfLines={2}>
                                    {copy.title}
                                </Text>
                            ) : null}
                            {copy.subtitle ? (
                                <Text variant="caption" style={styles.onImageMuted} numberOfLines={2}>
                                    {copy.subtitle}
                                </Text>
                            ) : null}
                        </View>
                    </>
                ) : null}
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing.xl,
    },
    frame: {
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
    },
    plate: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: theme.colors.surfaceElevated,
    },
    image: {
        ...StyleSheet.absoluteFillObject,
    },
    scrim: {
        ...StyleSheet.absoluteFillObject,
    },
    copy: {
        position: 'absolute',
        start: theme.spacing.lg,
        end: theme.spacing.lg,
        bottom: theme.spacing.lg,
        gap: theme.spacing.xs,
    },
    onImage: {color: '#ffffff'},
    onImageMuted: {color: 'rgba(255,255,255,0.85)'},
}));
