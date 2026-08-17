import {useCallback, useRef, useState} from 'react';
import {View, ScrollView, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent} from 'react-native';
import {Image} from 'expo-image';
import {StyleSheet} from 'react-native-unistyles';
import {IconSymbol} from '@/components/ui';

/**
 * Product gallery.
 *
 * A paging `ScrollView` rather than a virtualized list: a product carries a
 * handful of assets, and paging must be pixel-exact against the page width,
 * which is the one thing a recycler makes harder rather than easier.
 *
 * `contentFit="contain"` throughout, for the same reason `ProductCard` uses it:
 * this catalogue is components shot on white, and cropping a pin header out of
 * frame makes two different parts indistinguishable.
 *
 * The page indicator is a row of dots whose *index* is derived from the scroll
 * offset. Under RTL a paging ScrollView starts at the far end, so the index is
 * measured from the offset and mirrored by the row's own flex direction rather
 * than being tracked as an absolute page number.
 */
export interface ProductGalleryProps {
    images: readonly {id: string; preview: string}[];
}

export function ProductGallery({images}: ProductGalleryProps) {
    const {width} = useWindowDimensions();
    const [index, setIndex] = useState(0);
    const lastIndex = useRef(0);

    const onScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const page = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
            if (page !== lastIndex.current) {
                lastIndex.current = page;
                setIndex(page);
            }
        },
        [width],
    );

    if (images.length === 0) {
        return (
            <View style={[styles.page, {width, height: width}]}>
                <IconSymbol name="chip" size={32} color="textMuted" />
            </View>
        );
    }

    return (
        <View>
            <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={32}
            >
                {images.map(asset => (
                    <View key={asset.id} style={[styles.page, {width, height: width}]}>
                        <Image
                            source={{uri: asset.preview}}
                            style={styles.image}
                            contentFit="contain"
                            transition={180}
                            accessibilityIgnoresInvertColors
                        />
                    </View>
                ))}
            </ScrollView>

            {images.length > 1 ? (
                <View style={styles.dots}>
                    {images.map((asset, dotIndex) => (
                        <View
                            key={asset.id}
                            style={[styles.dot, dotIndex === index && styles.dotActive]}
                        />
                    ))}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    page: {
        backgroundColor: theme.colors.surfaceElevated,
        alignItems: 'center',
        justifyContent: 'center',
    },
    image: {width: '100%', height: '100%'},
    dots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.md,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.border,
    },
    dotActive: {
        // The accent marks state, which is exactly what the current page is.
        backgroundColor: theme.colors.brand,
        width: 18,
    },
}));
