import {Pressable, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, IconSymbol, Divider} from '@/components/ui';

/**
 * One step of the checkout, as a collapsible section.
 *
 * An accordion rather than five pushed routes. On a phone a stepped checkout
 * that navigates loses the two things people need most while entering an
 * address: the ability to see what they already answered, and a back gesture
 * that does not feel like abandoning the purchase. Collapsed steps keep their
 * summary visible ("Yalidine Stop Desk · Bab Ezzouar"), which is also what
 * makes the review step honest instead of a second copy of the form.
 *
 * A completed step is tappable to reopen; a locked one is not, and says so
 * through `accessibilityState` rather than only by looking grey.
 */

export type StepState = 'locked' | 'open' | 'complete';

export interface StepSectionProps {
    index: number;
    title: string;
    state: StepState;
    /** One-line recap shown when the step is collapsed and complete. */
    summary?: string;
    onPress?: () => void;
    children?: React.ReactNode;
}

export function StepSection({
    index,
    title,
    state,
    summary,
    onPress,
    children,
}: StepSectionProps) {
    const isOpen = state === 'open';
    const canOpen = state === 'complete' && Boolean(onPress);

    styles.useVariants({state});

    return (
        <View style={styles.root}>
            <Pressable
                accessibilityRole="button"
                accessibilityState={{expanded: isOpen, disabled: !canOpen && !isOpen}}
                accessibilityLabel={title}
                disabled={!canOpen}
                onPress={onPress}
                style={styles.header}
            >
                <View style={styles.marker}>
                    {state === 'complete' ? (
                        <IconSymbol name="check" size={14} color="onBrand" />
                    ) : (
                        <Text
                            variant="caption"
                            color={isOpen ? 'onBrand' : 'textMuted'}
                            tabular
                        >
                            {String(index)}
                        </Text>
                    )}
                </View>

                <View style={styles.headerText}>
                    <Text
                        variant={isOpen ? 'bodyStrong' : 'body'}
                        color={state === 'locked' ? 'textMuted' : 'text'}
                        numberOfLines={1}
                    >
                        {title}
                    </Text>
                    {!isOpen && summary ? (
                        <Text variant="micro" color="textMuted" numberOfLines={2}>
                            {summary}
                        </Text>
                    ) : null}
                </View>

                {canOpen ? <IconSymbol name="edit" size={16} color="brand" /> : null}
            </Pressable>

            {isOpen ? (
                <View style={styles.body}>
                    <Divider />
                    <View style={styles.content}>{children}</View>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        borderRadius: theme.radius.lg,
        borderWidth: theme.elevation.card.borderWidth,
        overflow: 'hidden',
        variants: {
            state: {
                // Elevation as tint: the open step is the raised one.
                open: {
                    borderColor: theme.colors.brand,
                    backgroundColor: theme.colors.surfaceElevated,
                },
                complete: {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                },
                locked: {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.background,
                },
            },
        },
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        minHeight: 56,
    },
    marker: {
        width: 26,
        height: 26,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: theme.elevation.card.borderWidth,
        variants: {
            state: {
                open: {backgroundColor: theme.colors.brand, borderColor: theme.colors.brand},
                complete: {
                    backgroundColor: theme.colors.success,
                    borderColor: theme.colors.success,
                },
                locked: {
                    backgroundColor: 'transparent',
                    borderColor: theme.colors.border,
                },
            },
        },
    },
    headerText: {flex: 1, gap: theme.spacing.xs},
    body: {},
    content: {
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.lg,
        gap: theme.spacing.lg,
    },
}));
