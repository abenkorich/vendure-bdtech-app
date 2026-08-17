import {useState} from 'react';
import {View} from 'react-native';
import * as Haptics from 'expo-haptics';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Button, Badge} from '@/components/ui';
import {TextField} from './TextField';
import {CART_STRINGS} from '../strings';
import {presentError} from '../errors';

/**
 * Coupon entry.
 *
 * Not optimistic, unlike the rest of the cart: only the server knows what a
 * promotion is worth, and a discount that appears and then vanishes is worse
 * than one that takes a moment. So this is the one place in the cart with a
 * spinner, and the failure message is Vendure's own — "coupon expired" and
 * "coupon not valid" are different problems to the customer.
 */

export interface CouponFieldProps {
    appliedCodes: readonly string[];
    onApply: (code: string) => Promise<unknown>;
    onRemove: (code: string) => void;
    applying: boolean;
}

export function CouponField({appliedCodes, onApply, onRemove, applying}: CouponFieldProps) {
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        const trimmed = code.trim();
        if (!trimmed) return;
        setError(null);
        try {
            await onApply(trimmed);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setCode('');
        } catch (caught) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setError(presentError(caught).message);
        }
    };

    return (
        <View style={styles.root}>
            <Text variant="caption" color="textMuted" uppercase>
                {CART_STRINGS.promotionCode}
            </Text>

            {appliedCodes.length > 0 ? (
                <View style={styles.chips}>
                    {appliedCodes.map(applied => (
                        <View key={applied} style={styles.chip}>
                            <Badge tone="success" icon="tag">
                                {applied}
                            </Badge>
                            <Button
                                variant="ghost"
                                size="sm"
                                icon="close"
                                accessibilityLabel={`${CART_STRINGS.remove} ${applied}`}
                                onPress={() => onRemove(applied)}
                            />
                        </View>
                    ))}
                </View>
            ) : null}

            <View style={styles.row}>
                <View style={styles.field}>
                    <TextField
                        value={code}
                        onChangeText={value => {
                            setCode(value);
                            if (error) setError(null);
                        }}
                        placeholder={CART_STRINGS.enterCode}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        returnKeyType="done"
                        onSubmitEditing={() => void submit()}
                        error={error}
                    />
                </View>
                <Button
                    variant="secondary"
                    onPress={() => void submit()}
                    loading={applying}
                    disabled={code.trim().length === 0}
                >
                    {CART_STRINGS.apply}
                </Button>
            </View>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {gap: theme.spacing.sm},
    row: {flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm},
    field: {flex: 1},
    chips: {flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm},
    chip: {flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs},
}));
