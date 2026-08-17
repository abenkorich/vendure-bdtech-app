import {KeyboardAvoidingView, Platform, ScrollView, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text} from '@/components/ui';
import {BackHeader} from '@/features/account/components/chrome';
import {Hint} from './instrument';

/**
 * Layout every tool screen sits in.
 *
 * `KeyboardAvoidingView` matters more here than on a form: the readout is what
 * the user is watching while typing, so a keyboard covering it defeats the
 * whole live-calculation premise.
 */
export function ToolScreenBody({
    title,
    description,
    hint,
    children,
}: {
    title: string;
    description?: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <BackHeader title={title} />
            <ScrollView
                style={styles.flex}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
            >
                {description ? (
                    <Text variant="body" color="textMuted">
                        {description}
                    </Text>
                ) : null}
                {hint ? <Hint>{hint}</Hint> : null}
                <View style={styles.sections}>{children}</View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create(theme => ({
    flex: {flex: 1},
    content: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing['3xl'],
        gap: theme.spacing.sm,
    },
    sections: {gap: theme.spacing.xl, paddingTop: theme.spacing.md},
}));
