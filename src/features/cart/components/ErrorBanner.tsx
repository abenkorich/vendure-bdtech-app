import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useTranslations} from '@/i18n';
import {Text, Button, IconSymbol} from '@/components/ui';
import {CART_STRINGS} from '../strings';
import type {PresentedError} from '../errors';

/**
 * Inline error banner.
 *
 * A retry button appears only for a `ServerUnreachableError`. Offering "try
 * again" on a rejected coupon or an out-of-stock line teaches the customer to
 * hammer a button that cannot succeed, and hides the real message.
 */

export interface ErrorBannerProps {
    error: PresentedError | null;
    onRetry?: () => void;
    onDismiss?: () => void;
}

export function ErrorBanner({error, onRetry, onDismiss}: ErrorBannerProps) {
    // Before the early return: a hook after a conditional return is a
    // rules-of-hooks violation and would crash on the render where error
    // flips from null to set.
    const tCommon = useTranslations('Common');

    if (!error) return null;

    return (
        <View style={styles.root} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <IconSymbol name="error" size={18} color="danger" />

            <View style={styles.body}>
                <Text variant="caption" color="danger">
                    {error.message}
                </Text>

                {error.retryable && onRetry ? (
                    <View style={styles.actions}>
                        <Button variant="ghost" size="sm" icon="refresh" onPress={onRetry}>
                            {CART_STRINGS.tryAgain}
                        </Button>
                    </View>
                ) : null}
            </View>

            {onDismiss ? (
                <Button
                    variant="ghost"
                    size="sm"
                    icon="close"
                    accessibilityLabel={tCommon('dismiss')}
                    onPress={onDismiss}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.danger,
        backgroundColor: theme.colors.surface,
    },
    body: {flex: 1, gap: theme.spacing.xs},
    actions: {flexDirection: 'row'},
}));
