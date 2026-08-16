import {Text as RNText, type TextProps as RNTextProps} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import type {AppColors} from '@/design/tokens';

/**
 * Typography primitive. Every string in the app renders through this, so the
 * type scale is enforced rather than suggested.
 *
 * `tabular` is the reason this is not just `<RNText style={theme.typography.x}>`:
 * prices, SKUs and spec values must use `fontVariant: ['tabular-nums']` so
 * digits share a width. Without it a price jitters horizontally as a quantity
 * changes, and a column of specs fails to line up.
 */

export type TextVariant =
    | 'display'
    | 'title'
    | 'heading'
    | 'body'
    | 'bodyStrong'
    | 'caption'
    | 'micro';

export type TextColor = keyof AppColors;

export interface TextProps extends RNTextProps {
    variant?: TextVariant;
    color?: TextColor;
    /**
     * Monospaced digits. Set this for any number the user compares or watches
     * update: prices, quantities, SKUs, spec values, order totals.
     */
    tabular?: boolean;
    /** Uppercase with wide tracking — for labels and badges, not prose. */
    uppercase?: boolean;
    /** Text alignment. `start`/`end` are direction-aware; avoid left/right. */
    align?: 'auto' | 'start' | 'end' | 'center';
    children?: React.ReactNode;
}

export function Text({
    variant = 'body',
    color = 'text',
    tabular = false,
    uppercase = false,
    align = 'auto',
    style,
    ...rest
}: TextProps) {
    styles.useVariants({variant, color, align});

    return (
        <RNText
            style={[
                styles.text,
                tabular && styles.tabular,
                uppercase && styles.uppercase,
                style,
            ]}
            {...rest}
        />
    );
}

const styles = StyleSheet.create(theme => ({
    text: {
        variants: {
            variant: {
                display: theme.typography.display,
                title: theme.typography.title,
                heading: theme.typography.heading,
                body: theme.typography.body,
                bodyStrong: theme.typography.bodyStrong,
                caption: theme.typography.caption,
                micro: theme.typography.micro,
            },
            color: {
                background: {color: theme.colors.background},
                surface: {color: theme.colors.surface},
                surfaceElevated: {color: theme.colors.surfaceElevated},
                text: {color: theme.colors.text},
                textMuted: {color: theme.colors.textMuted},
                border: {color: theme.colors.border},
                brand: {color: theme.colors.brand},
                onBrand: {color: theme.colors.onBrand},
                brandMuted: {color: theme.colors.brandMuted},
                sale: {color: theme.colors.sale},
                success: {color: theme.colors.success},
                danger: {color: theme.colors.danger},
                skeleton: {color: theme.colors.skeleton},
            },
            align: {
                // `start`/`end` resolve against the writing direction, so an
                // Arabic screen aligns correctly without a branch at each site.
                auto: {textAlign: 'auto'},
                start: {textAlign: 'left'},
                end: {textAlign: 'right'},
                center: {textAlign: 'center'},
            },
        },
    },
    tabular: {
        fontVariant: ['tabular-nums'],
    },
    uppercase: {
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
}));
