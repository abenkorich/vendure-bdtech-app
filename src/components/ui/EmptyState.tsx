import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text} from './Text';
import {Button} from './Button';
import {IconSymbol, type IconName} from './IconSymbol';

/**
 * Empty state — no results, empty cart, no orders, and errors.
 *
 * Always offers an action where one exists. An empty screen with no way
 * forward is indistinguishable from a broken one, which is the failure mode
 * this project has already been bitten by on the web.
 */

export interface EmptyStateProps {
    icon?: IconName;
    title: string;
    message?: string;
    /** Primary action. Omit only when there is genuinely nothing to do. */
    action?: {label: string; onPress: () => void};
    /** Secondary action, e.g. "Retry" beside "Go home". */
    secondaryAction?: {label: string; onPress: () => void};
    /** `error` tints the icon with the danger color. */
    tone?: 'neutral' | 'error';
}

export function EmptyState({
    icon = 'empty',
    title,
    message,
    action,
    secondaryAction,
    tone = 'neutral',
}: EmptyStateProps) {
    return (
        <View style={styles.root} accessibilityRole="summary">
            <View style={styles.iconWell}>
                <IconSymbol
                    name={tone === 'error' ? 'error' : icon}
                    size={28}
                    color={tone === 'error' ? 'danger' : 'textMuted'}
                />
            </View>

            <Text variant="heading" align="center">
                {title}
            </Text>

            {message ? (
                <Text variant="body" color="textMuted" align="center" style={styles.message}>
                    {message}
                </Text>
            ) : null}

            {action || secondaryAction ? (
                <View style={styles.actions}>
                    {action ? (
                        <Button variant="primary" onPress={action.onPress}>
                            {action.label}
                        </Button>
                    ) : null}
                    {secondaryAction ? (
                        <Button variant="ghost" onPress={secondaryAction.onPress}>
                            {secondaryAction.label}
                        </Button>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing['3xl'],
    },
    iconWell: {
        width: 56,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.surfaceElevated,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
        marginBottom: theme.spacing.xs,
    },
    message: {
        maxWidth: 320,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        marginTop: theme.spacing.sm,
    },
}));
