import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text} from './Text';
import {IconSymbol, type IconName} from './IconSymbol';

/**
 * Badge — a small state marker: stock, sale, order status, "new".
 *
 * Tones are muted washes with a colored label rather than solid fills, except
 * `sale`, which is deliberately loud because a discount is the one thing on a
 * product card that should interrupt the scan. Solid brand fills everywhere
 * would be exactly the "accent as decoration" this system forbids.
 */

export type BadgeTone = 'brand' | 'sale' | 'success' | 'danger' | 'neutral';

export interface BadgeProps {
    children: string;
    tone?: BadgeTone;
    /** Solid fill instead of the muted wash. Reserve for sale/urgency. */
    solid?: boolean;
    icon?: IconName;
}

const LABEL_COLOR = {
    brand: 'brand',
    sale: 'sale',
    success: 'success',
    danger: 'danger',
    neutral: 'textMuted',
} as const;

export function Badge({children, tone = 'brand', solid = false, icon}: BadgeProps) {
    styles.useVariants({tone, solid});
    const color = solid ? 'onBrand' : LABEL_COLOR[tone];

    return (
        <View style={styles.badge}>
            {icon ? <IconSymbol name={icon} size={12} color={color} /> : null}
            <Text variant="micro" color={color} uppercase numberOfLines={1}>
                {children}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        alignSelf: 'flex-start',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.radius.sm,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: 'transparent',
        variants: {
            tone: {
                brand: {backgroundColor: theme.colors.brandMuted},
                sale: {backgroundColor: theme.colors.brandMuted},
                success: {backgroundColor: theme.colors.surfaceElevated},
                danger: {backgroundColor: theme.colors.surfaceElevated},
                neutral: {
                    backgroundColor: theme.colors.surfaceElevated,
                    borderColor: theme.colors.border,
                },
            },
            solid: {
                true: {},
                false: {},
            },
        },
        compoundVariants: [
            // A solid badge fills with its own tone; the muted washes above are
            // the default because a screen of solid chips is decoration.
            {tone: 'brand', solid: true, styles: {backgroundColor: theme.colors.brand}},
            {tone: 'sale', solid: true, styles: {backgroundColor: theme.colors.sale}},
            {tone: 'success', solid: true, styles: {backgroundColor: theme.colors.success}},
            {tone: 'danger', solid: true, styles: {backgroundColor: theme.colors.danger}},
            {
                tone: 'neutral',
                solid: true,
                styles: {backgroundColor: theme.colors.textMuted},
            },
        ],
    },
}));
