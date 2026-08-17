import {useMemo, useState} from 'react';
import {TextInput} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Text} from '@/components/ui';
import {Segmented} from '@/features/account/components/chrome';
import {
    decodeSmdCode,
    encodeResistanceToSmdCodes,
    EIA96_MULTIPLIERS,
    type SmdMarkingType,
} from '@/lib/tools/smd-code';
import {formatResistance, formatExactOhms} from '@/lib/tools/resistor-color-code';
import {decodeRDecimalMatch} from '@/features/tools/smd-r-notation';
import {useT} from '@/features/account/i18n';
import {Readout, Education, Panel, CalcError} from './instrument';

/**
 * SMD marking decoder/encoder.
 *
 * The code field is its own input rather than the shared `ValueField`: markings
 * are alphanumeric (`4R7`, `01A`), so it needs a text keyboard, auto-caps and
 * no decimal pad. It is also the only field in the tools area where the user
 * types letters, which is why it does not share the numeric styling.
 */
type Direction = 'decode' | 'encode';

export function SmdCodeTool() {
    const t = useT('Tools.smdCode');
    const {theme} = useUnistyles();

    const [direction, setDirection] = useState<Direction>('decode');
    const [markingType, setMarkingType] = useState<SmdMarkingType>('3digit');
    const [code, setCode] = useState('103');
    const [value, setValue] = useState('4.7k');

    /**
     * `4R7` is R-notation, which the ported engine does not handle (it is
     * numeric-only). Try that first, then fall back — otherwise a perfectly
     * valid sub-10 Ω marking reads as "invalid code".
     */
    const decoded = useMemo(() => {
        const rNotation = decodeRDecimalMatch(code);
        if (rNotation) {
            return {ohms: rNotation.ohms, formatted: rNotation.formatted, error: undefined};
        }
        return decodeSmdCode(code, markingType);
    }, [code, markingType]);

    const encoded = useMemo(
        () => encodeResistanceToSmdCodes(value, markingType),
        [value, markingType],
    );

    return (
        <>
            <Panel>
                <Segmented
                    label={t('markingType')}
                    value={markingType}
                    onChange={setMarkingType}
                    options={[
                        {value: '3digit', label: t('marking3digit')},
                        {value: '4digit', label: t('marking4digit')},
                        {value: 'eia96', label: t('markingEia96')},
                    ]}
                />
                <Segmented
                    label={t('markingType')}
                    value={direction}
                    onChange={setDirection}
                    options={[
                        {value: 'decode', label: t('decodeTab')},
                        {value: 'encode', label: t('encodeTab')},
                    ]}
                />
            </Panel>

            {direction === 'decode' ? (
                <>
                    <Panel>
                        <Text variant="micro" color="textMuted" uppercase>
                            {t('codeInput')}
                        </Text>
                        <TextInput
                            style={styles.codeInput}
                            value={code}
                            onChangeText={setCode}
                            placeholder={t(`codePlaceholder.${markingType}`)}
                            placeholderTextColor={theme.colors.textMuted}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            accessibilityLabel={t('codeInput')}
                            textAlign="center"
                        />
                    </Panel>

                    {decoded === null ? null : decoded.error ? (
                        <CalcError>{t('invalidCode')}</CalcError>
                    ) : (
                        <Readout
                            rows={[
                                {
                                    label: t('decodedValue'),
                                    value: decoded.formatted,
                                    primary: true,
                                },
                                {label: t('valueInput'), value: formatExactOhms(decoded.ohms)},
                            ]}
                        />
                    )}
                </>
            ) : (
                <>
                    <Panel>
                        <Text variant="micro" color="textMuted" uppercase>
                            {t('valueInput')}
                        </Text>
                        <TextInput
                            style={styles.codeInput}
                            value={value}
                            onChangeText={setValue}
                            placeholder={t('valuePlaceholder')}
                            placeholderTextColor={theme.colors.textMuted}
                            autoCapitalize="none"
                            autoCorrect={false}
                            accessibilityLabel={t('valueInput')}
                            textAlign="center"
                        />
                    </Panel>

                    {encoded.length === 0 ? (
                        <CalcError>{t('noMatch')}</CalcError>
                    ) : (
                        <Readout
                            title={t('possibleCodes')}
                            rows={encoded.map(match => ({
                                label: match.formatted,
                                value: match.code,
                            }))}
                        />
                    )}
                </>
            )}

            <Panel title={t('referenceTitle')}>
                <Text variant="caption" color="textMuted">
                    {t(`reference.${markingType}`)}
                </Text>
                {markingType === 'eia96' ? (
                    <Readout
                        rows={Object.entries(EIA96_MULTIPLIERS).map(([letter, multiplier]) => ({
                            label: `${t('multiplierLetter')} ${letter}`,
                            value: `×${formatResistance(multiplier).replace('Ω', '')}`,
                        }))}
                    />
                ) : null}
            </Panel>

            <Education title={t('educationTitle')} body={t('educationBody')} />
        </>
    );
}

const styles = StyleSheet.create(theme => ({
    codeInput: {
        minHeight: 56,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radius.md,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        color: theme.colors.text,
        fontSize: theme.typography.title.fontSize,
        fontWeight: theme.typography.title.fontWeight,
        letterSpacing: 2,
        fontVariant: ['tabular-nums'],
    },
}));
