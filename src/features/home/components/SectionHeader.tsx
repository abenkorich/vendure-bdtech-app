import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Button} from '@/components/ui';

/**
 * Section header — the repeating unit of the home screen.
 *
 * Eyebrow / title / optional action, on a tight grid. The eyebrow is what makes
 * a stack of rails scannable: it names the *reason* the rail exists ("Just
 * landed") where the title names its contents.
 *
 * The action is a ghost button rather than a bare link so its touch target is a
 * real 44pt one.
 */
export interface SectionHeaderProps {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    action?: {label: string; onPress: () => void};
}

export function SectionHeader({eyebrow, title, subtitle, action}: SectionHeaderProps) {
    return (
        <View style={styles.root}>
            <View style={styles.text}>
                {eyebrow ? (
                    <Text variant="micro" color="brand" uppercase>
                        {eyebrow}
                    </Text>
                ) : null}
                <Text variant="heading">{title}</Text>
                {subtitle ? (
                    <Text variant="caption" color="textMuted" numberOfLines={2}>
                        {subtitle}
                    </Text>
                ) : null}
            </View>

            {action ? (
                <Button variant="ghost" size="sm" iconEnd="chevronForward" onPress={action.onPress}>
                    {action.label}
                </Button>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing.md,
    },
    text: {
        flex: 1,
        gap: theme.spacing.xs,
    },
}));
