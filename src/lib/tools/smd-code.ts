import {formatResistance, parseResistanceInput} from '@/lib/tools/resistor-color-code';

export type SmdMarkingType = '3digit' | '4digit' | 'eia96';

export interface SmdDecodeResult {
    ohms: number;
    formatted: string;
    markingType: SmdMarkingType;
    error?: string;
}

export interface SmdEncodeMatch {
    code: string;
    markingType: SmdMarkingType;
    ohms: number;
    formatted: string;
}

const EIA96_VALUES: readonly number[] = [
    100, 102, 105, 107, 110, 113, 115, 118, 121, 124, 127, 130, 133, 137, 140, 143, 147, 150, 154, 158,
    162, 165, 169, 174, 178, 182, 187, 191, 196, 200, 205, 210, 215, 221, 226, 232, 237, 243, 249, 255,
    261, 267, 274, 280, 287, 294, 301, 309, 316, 324, 332, 340, 348, 357, 365, 374, 383, 392, 402, 412,
    422, 432, 442, 453, 464, 475, 487, 499, 511, 523, 536, 549, 562, 576, 590, 604, 619, 634, 649, 665,
    681, 698, 715, 732, 750, 768, 787, 806, 825, 845, 866, 887, 909, 931, 953, 976,
];

export const EIA96_MULTIPLIERS: Record<string, number> = {
    Z: 0.001,
    Y: 0.01,
    X: 0.1,
    R: 1,
    A: 10,
    B: 100,
    C: 1_000,
    D: 10_000,
    E: 100_000,
    F: 1_000_000,
};

const EIA96_MULTIPLIER_LETTERS = Object.keys(EIA96_MULTIPLIERS);

function isNearlyEqual(a: number, b: number, tolerance = 0.001): boolean {
    if (a === b) return true;
    const max = Math.max(Math.abs(a), Math.abs(b));
    return Math.abs(a - b) <= max * tolerance;
}

export function decodeSmdCode(code: string, markingType: SmdMarkingType): SmdDecodeResult | null {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return null;

    if (markingType === '3digit') {
        if (!/^\d{3}$/.test(trimmed)) {
            return {ohms: 0, formatted: '—', markingType, error: 'invalid_code'};
        }
        const significant = Number.parseInt(trimmed.slice(0, 2), 10);
        const multiplier = Number.parseInt(trimmed[2], 10);
        if (significant === 0) {
            return {ohms: 0, formatted: '—', markingType, error: 'invalid_code'};
        }
        const ohms = significant * 10 ** multiplier;
        return {ohms, formatted: formatResistance(ohms), markingType};
    }

    if (markingType === '4digit') {
        if (!/^\d{4}$/.test(trimmed)) {
            return {ohms: 0, formatted: '—', markingType, error: 'invalid_code'};
        }
        const significant = Number.parseInt(trimmed.slice(0, 3), 10);
        const multiplier = Number.parseInt(trimmed[3], 10);
        if (significant === 0) {
            return {ohms: 0, formatted: '—', markingType, error: 'invalid_code'};
        }
        const ohms = significant * 10 ** multiplier;
        return {ohms, formatted: formatResistance(ohms), markingType};
    }

    if (!/^\d{2}[A-Z]$/.test(trimmed)) {
        return {ohms: 0, formatted: '—', markingType, error: 'invalid_code'};
    }

    const codeIndex = Number.parseInt(trimmed.slice(0, 2), 10);
    const multiplierLetter = trimmed[2];
    if (codeIndex < 1 || codeIndex > 96 || !(multiplierLetter in EIA96_MULTIPLIERS)) {
        return {ohms: 0, formatted: '—', markingType, error: 'invalid_code'};
    }

    const base = EIA96_VALUES[codeIndex - 1];
    const ohms = base * EIA96_MULTIPLIERS[multiplierLetter];
    return {ohms, formatted: formatResistance(ohms), markingType};
}

export function encodeResistanceToSmdCodes(
    input: string,
    markingType?: SmdMarkingType,
): SmdEncodeMatch[] {
    const ohms = parseResistanceInput(input);
    if (ohms === null) return [];

    const types: SmdMarkingType[] = markingType ? [markingType] : ['3digit', '4digit', 'eia96'];
    const matches: SmdEncodeMatch[] = [];

    for (const type of types) {
        if (type === '3digit') {
            for (let multiplier = 0; multiplier <= 9; multiplier += 1) {
                const divisor = 10 ** multiplier;
                const significant = ohms / divisor;
                if (!Number.isInteger(significant) || significant < 1 || significant > 99) continue;
                const code = `${String(significant).padStart(2, '0')}${multiplier}`;
                matches.push({
                    code,
                    markingType: type,
                    ohms: significant * divisor,
                    formatted: formatResistance(significant * divisor),
                });
            }
        } else if (type === '4digit') {
            for (let multiplier = 0; multiplier <= 9; multiplier += 1) {
                const divisor = 10 ** multiplier;
                const significant = ohms / divisor;
                if (!Number.isInteger(significant) || significant < 1 || significant > 999) continue;
                const code = `${String(significant).padStart(3, '0')}${multiplier}`;
                matches.push({
                    code,
                    markingType: type,
                    ohms: significant * divisor,
                    formatted: formatResistance(significant * divisor),
                });
            }
        } else {
            for (let codeIndex = 1; codeIndex <= 96; codeIndex += 1) {
                const base = EIA96_VALUES[codeIndex - 1];
                for (const letter of EIA96_MULTIPLIER_LETTERS) {
                    const value = base * EIA96_MULTIPLIERS[letter];
                    if (isNearlyEqual(value, ohms)) {
                        matches.push({
                            code: `${String(codeIndex).padStart(2, '0')}${letter}`,
                            markingType: type,
                            ohms: value,
                            formatted: formatResistance(value),
                        });
                    }
                }
            }
        }
    }

    return matches;
}

export {parseResistanceInput, formatResistance};
