import {Pressable, View} from 'react-native';
import {Image} from 'expo-image';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Price, Button} from '@/components/ui';
import type {SavedProduct} from '../saved-core';

/**
 * A saved product row.
 *
 * The price is the snapshot taken when the product was saved, rendered through
 * `<Price>` like every other money value in the app. It is a snapshot on
 * purpose (see `saved-core.ts`): a list that shows nothing until 40 network
 * requests resolve is a worse lie than a price that is a day old.
 *
 * Remove is an icon button rather than a swipe. A swipe-to-delete has to be
 * mirrored in Arabic and is undiscoverable either way, and this list is not
 * long enough to need the density.
 */

export interface SavedProductRowProps {
    item: SavedProduct;
    onPress: () => void;
    onRemove: () => void;
    removeLabel: string;
    /** Row actions rendered under the title (add to cart, compare). */
    trailing?: React.ReactNode;
}

export function SavedProductRow({
    item,
    onPress,
    onRemove,
    removeLabel,
    trailing,
}: SavedProductRowProps) {
    return (
        <View style={styles.root}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.name}
                onPress={onPress}
                style={styles.main}
            >
                {item.imageUrl ? (
                    <Image
                        source={{uri: item.imageUrl}}
                        style={styles.thumb}
                        contentFit="cover"
                        transition={120}
                    />
                ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]} />
                )}

                <View style={styles.body}>
                    <Text variant="bodyStrong" numberOfLines={2}>
                        {item.name}
                    </Text>
                    <Price
                        value={item.priceWithTax}
                        currencyCode={item.currencyCode}
                        size="sm"
                    />
                </View>

                <Button
                    variant="ghost"
                    size="sm"
                    icon="trash"
                    accessibilityLabel={removeLabel}
                    onPress={onRemove}
                />
            </Pressable>

            {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.md,
    },
    main: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    thumb: {
        width: 64,
        height: 64,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceElevated,
    },
    thumbEmpty: {
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
    },
    body: {flex: 1, gap: theme.spacing.xs},
    trailing: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: theme.spacing.sm,
        flexWrap: 'wrap',
    },
}));
