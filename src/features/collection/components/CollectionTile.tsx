import {View} from 'react-native';
import {Image} from 'expo-image';
import {StyleSheet} from 'react-native-unistyles';
import {Card, Text, IconSymbol} from '@/components/ui';

/**
 * Collection tile — the unit of every category grid and the shop tree.
 *
 * Deliberately not a `ProductCard` clone: a category is a destination, not a
 * purchasable, so it carries no price and its image is a 16:9 band rather than
 * a square. Making them look alike would invite the tap that expects a price.
 *
 * The chevron is a directional icon and mirrors itself in Arabic through
 * `IconSymbol`; the row's own direction comes from `flexDirection: 'row'`,
 * which RN already reverses under RTL.
 */
export interface CollectionTileProps {
    name: string;
    imageUrl?: string | null;
    /** e.g. "12 sub-collections". Optional metadata line. */
    meta?: string;
    onPress: () => void;
    /** `tile` (default) is the image-led grid cell; `row` is a dense list row. */
    layout?: 'tile' | 'row';
}

export function CollectionTile({
    name,
    imageUrl,
    meta,
    onPress,
    layout = 'tile',
}: CollectionTileProps) {
    if (layout === 'row') {
        return (
            <Card padding="md" onPress={onPress} accessibilityLabel={name} style={styles.row}>
                <View style={styles.rowThumb}>
                    {imageUrl ? (
                        <Image source={{uri: imageUrl}} style={styles.image} contentFit="contain" transition={160} />
                    ) : (
                        <IconSymbol name="chip" size={18} color="textMuted" />
                    )}
                </View>
                <View style={styles.rowText}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                        {name}
                    </Text>
                    {meta ? (
                        <Text variant="caption" color="textMuted" numberOfLines={1}>
                            {meta}
                        </Text>
                    ) : null}
                </View>
                <IconSymbol name="chevronForward" size={18} color="textMuted" />
            </Card>
        );
    }

    return (
        <Card padding="none" onPress={onPress} accessibilityLabel={name} style={styles.tile}>
            <View style={styles.media}>
                {imageUrl ? (
                    <Image
                        source={{uri: imageUrl}}
                        style={styles.image}
                        contentFit="contain"
                        transition={160}
                        accessibilityIgnoresInvertColors
                    />
                ) : (
                    <IconSymbol name="chip" size={24} color="textMuted" />
                )}
            </View>
            <View style={styles.body}>
                <Text variant="bodyStrong" numberOfLines={2}>
                    {name}
                </Text>
                {meta ? (
                    <Text variant="micro" color="textMuted" numberOfLines={1}>
                        {meta}
                    </Text>
                ) : null}
            </View>
        </Card>
    );
}

const styles = StyleSheet.create(theme => ({
    tile: {flex: 1},
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    rowThumb: {
        width: 44,
        height: 44,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.surfaceElevated,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    rowText: {flex: 1, gap: 2},
    media: {
        aspectRatio: 16 / 9,
        backgroundColor: theme.colors.surfaceElevated,
        alignItems: 'center',
        justifyContent: 'center',
    },
    image: {width: '100%', height: '100%'},
    body: {
        padding: theme.spacing.md,
        gap: theme.spacing.xs,
        // Two lines reserved so a grid of mixed-length names keeps a flat
        // baseline instead of a ragged one.
        minHeight: theme.typography.body.lineHeight * 2 + theme.spacing.md * 2,
    },
}));
