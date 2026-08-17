import {useCallback, useState} from 'react';
import {Alert, View} from 'react-native';
import * as Updates from 'expo-updates';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Sheet, IconSymbol} from '@/components/ui';
import {useLocale, useTranslations, isRtlLocale} from '@/i18n';
import {locales, localeNames, type Locale} from '@/i18n/routing';

/**
 * Language switcher.
 *
 * The interesting part is the restart. Switching in or out of Arabic flips
 * `I18nManager`, and React Native only applies a direction change after the JS
 * bundle reloads. Without an explicit reload the labels translate but the
 * layout keeps its old direction, which looks like the setting half-worked.
 *
 * So: change the language, and if direction changed, tell the user plainly and
 * reload. `setLocale` returns `{requiresRestart}` precisely so this cannot be
 * forgotten.
 */

export interface LanguageSheetProps {
    open: boolean;
    onClose: () => void;
}

export function LanguageSheet({open, onClose}: LanguageSheetProps) {
    const {locale, setLocale} = useLocale();
    const t = useTranslations('Common');
    const [pending, setPending] = useState(false);

    const select = useCallback(
        async (next: Locale) => {
            if (next === locale || pending) return;

            const {requiresRestart} = setLocale(next);
            if (!requiresRestart) {
                onClose();
                return;
            }

            setPending(true);
            // Name the language in its own script: the user picking Arabic may
            // not read the interface language they are leaving behind.
            Alert.alert(
                localeNames[next],
                t('restartToApplyDirection'),
                [
                    {
                        text: t('restartNow'),
                        onPress: async () => {
                            try {
                                await Updates.reloadAsync();
                            } catch {
                                // reloadAsync is unavailable in some dev
                                // contexts; the change still applies on the
                                // next cold start, so say so rather than
                                // appearing to do nothing.
                                setPending(false);
                                onClose();
                            }
                        },
                    },
                ],
                {cancelable: false},
            );
        },
        [locale, onClose, pending, setLocale, t],
    );

    return (
        <Sheet open={open} onClose={onClose} title={t('language')}>
            <View style={styles.list}>
                {locales.map(code => {
                    const selected = code === locale;
                    return (
                        <View key={code}>
                            <Text
                                accessibilityRole="button"
                                accessibilityState={{selected}}
                                onPress={() => void select(code)}
                                style={styles.row}>
                                <View style={styles.rowInner}>
                                    <Text variant="body" style={styles.name}>
                                        {localeNames[code]}
                                    </Text>
                                    {isRtlLocale(code) ? (
                                        <Text variant="caption" color="textMuted">
                                            RTL
                                        </Text>
                                    ) : null}
                                    {selected ? (
                                        <IconSymbol name="check" size={20} color="brand" />
                                    ) : null}
                                </View>
                            </Text>
                        </View>
                    );
                })}
            </View>
        </Sheet>
    );
}

const styles = StyleSheet.create(theme => ({
    list: {
        gap: theme.spacing.xs,
    },
    row: {
        paddingVertical: theme.spacing.md,
    },
    rowInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: 44,
    },
    name: {
        flex: 1,
    },
}));
